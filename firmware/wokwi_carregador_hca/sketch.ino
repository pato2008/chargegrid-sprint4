/*
 * ChargeGrid Intelligence — Totem do carregador GoodWe HCA (simulado no Wokwi)
 * ---------------------------------------------------------------------------
 * ESP32 que faz o papel do controlador de um ponto de recarga:
 *   - Potenciômetro (GPIO 34): o cliente escolhe o tipo de recarga
 *       (Lenta 7,4 kW | Rápida 22 kW | Prioridade).
 *   - Botão (GPIO 4): inicia a recarga -> chama start_session() no Supabase,
 *       que registra o carro e gera o OCPP StartTransaction.
 *       A sessão aparece no dashboard React em ~2 s.
 *   - A cada 5 s: chama tick() (redistribui a potência e encerra recargas
 *       completas) e get_demanda() (lê a demanda total).
 *   - LCD 16x2 I2C: tipo escolhido + demanda atual / limite.
 *   - LEDs: verde = folga | amarelo = carros carregando | vermelho = >= 95% do limite.
 *
 * Integração: ESP32 --HTTPS (REST/RPC)--> Supabase <--RPC/Realtime-- Dashboard
 *
 * Antes de rodar, preencha SUPABASE_URL e SUPABASE_ANON_KEY (mesmos valores
 * do .env do front). A anon key é pública por design; a segurança vem do RLS.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>

// ---------- Configuração ----------
const char* WIFI_SSID = "Wokwi-GUEST";   // rede do simulador Wokwi
const char* WIFI_PASS = "";
const char* SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
const char* SUPABASE_ANON_KEY = "COLE_A_ANON_KEY_AQUI";

const char* CLIENTE = "Totem HCA-01";   // aparece como cliente no dashboard
const char* MODELO  = "BYD Dolphin";
const float CAPACIDADE_BATERIA_KWH = 44.9;

const int PINO_POT = 34;
const int PINO_BOTAO = 4;
const int LED_VERDE = 25;
const int LED_AMARELO = 26;
const int LED_VERMELHO = 27;

const unsigned long INTERVALO_MS = 5000;

LiquidCrystal_I2C lcd(0x27, 16, 2);

struct TipoRecarga { const char* id; const char* rotulo; };
const TipoRecarga TIPOS[] = {
  {"lenta", "Lenta  7,4kW"},
  {"rapida", "Rapida  22kW"},
  {"prioridade", "Prioridade"},
};

float demandaKw = 0, limiteKw = 100;
int carregadoresAtivos = 0;
unsigned long ultimaConsulta = 0;
bool botaoAnterior = HIGH;
String mensagem = "";

// ---------- Utilidades ----------
int tipoSelecionado() {
  int leitura = analogRead(PINO_POT);          // 0..4095
  return constrain(leitura * 3 / 4096, 0, 2);
}

// Chama uma função RPC do Supabase. Retorna o código HTTP e preenche resposta.
int chamarRpc(const char* funcao, const String& corpo, String& resposta) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  WiFiClientSecure cliente;
  cliente.setInsecure();                         // simulador: sem validação de certificado
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/rpc/" + funcao;
  http.begin(cliente, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  int codigo = http.POST(corpo);
  resposta = http.getString();
  http.end();
  return codigo;
}

void atualizarLeds() {
  bool critico = limiteKw > 0 && demandaKw >= 0.95 * limiteKw;
  digitalWrite(LED_VERMELHO, critico);
  digitalWrite(LED_AMARELO, !critico && carregadoresAtivos > 0);
  digitalWrite(LED_VERDE, !critico && carregadoresAtivos == 0);
}

void atualizarLcd() {
  lcd.setCursor(0, 0);
  if (mensagem.length() > 0) {
    lcd.print((mensagem + "                ").substring(0, 16));
  } else {
    lcd.print((String(TIPOS[tipoSelecionado()].rotulo) + "                ").substring(0, 16));
  }
  lcd.setCursor(0, 1);
  char linha[17];
  snprintf(linha, sizeof(linha), "Rede %3.0f/%3.0fkW%c", demandaKw, limiteKw,
           carregadoresAtivos > 9 ? '+' : '0' + carregadoresAtivos);
  lcd.print(linha);
}

// ---------- Ações ----------
void iniciarRecarga() {
  const TipoRecarga& tipo = TIPOS[tipoSelecionado()];
  JsonDocument corpo;
  corpo["p_client_name"] = CLIENTE;
  corpo["p_vehicle_model"] = MODELO;
  corpo["p_charge_type"] = tipo.id;
  corpo["p_battery_capacity_kwh"] = CAPACIDADE_BATERIA_KWH;
  String json, resposta;
  serializeJson(corpo, json);

  mensagem = "Iniciando...";
  atualizarLcd();
  int codigo = chamarRpc("start_session", json, resposta);
  Serial.printf("[start_session] HTTP %d -> %s\n", codigo, resposta.c_str());

  if (codigo == 200) {
    JsonDocument doc;
    if (!deserializeJson(doc, resposta)) {
      Serial.printf("[OCPP] StartTransaction aceito, sessao %d\n", doc["id"].as<int>());
    }
    mensagem = "Recarga iniciada";
  } else if (resposta.indexOf("limite") >= 0) {
    mensagem = "Sem vaga (10/10)";      // regra de negócio do banco
  } else {
    mensagem = "Erro HTTP " + String(codigo);
  }
}

void consultarSistema() {
  String resposta;
  int codigo = chamarRpc("tick", "{}", resposta);           // avança a simulação
  if (codigo != 200 && codigo != 204) {
    Serial.printf("[tick] HTTP %d -> %s\n", codigo, resposta.c_str());
  }

  codigo = chamarRpc("get_demanda", "{}", resposta);
  if (codigo == 200) {
    JsonDocument doc;
    if (!deserializeJson(doc, resposta)) {
      demandaKw = doc["currentKw"] | 0.0;
      limiteKw = doc["limitKw"] | 100.0;
      carregadoresAtivos = doc["activeChargers"] | 0;
      Serial.printf("[demanda] %.1f / %.0f kW | %d carros\n", demandaKw, limiteKw, carregadoresAtivos);
    }
  } else {
    Serial.printf("[get_demanda] HTTP %d -> %s\n", codigo, resposta.c_str());
  }
}

// ---------- Ciclo principal ----------
void setup() {
  Serial.begin(115200);
  pinMode(PINO_BOTAO, INPUT_PULLUP);
  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_AMARELO, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);

  lcd.init();
  lcd.backlight();
  lcd.print("ChargeGrid HCA");
  lcd.setCursor(0, 1);
  lcd.print("Conectando WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASS, 6);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println("\nWiFi conectado");
  Serial.println("[OCPP] BootNotification -> ChargeGrid HCA-01 online");
  lcd.clear();
  consultarSistema();
  ultimaConsulta = millis();
}

void loop() {
  bool botao = digitalRead(PINO_BOTAO);
  if (botaoAnterior == HIGH && botao == LOW) {   // borda de descida = clique
    iniciarRecarga();
    consultarSistema();
    ultimaConsulta = millis();
  }
  botaoAnterior = botao;

  if (millis() - ultimaConsulta >= INTERVALO_MS) {
    consultarSistema();
    ultimaConsulta = millis();
    mensagem = "";                     // limpa o aviso depois de um ciclo
  }

  atualizarLeds();
  atualizarLcd();
  delay(50);
}

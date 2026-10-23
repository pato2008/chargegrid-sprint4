type ClassValue = string | number | boolean | null | undefined | ClassValue[];

function flatten(value: ClassValue, out: string[]) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((v) => flatten(v, out));
    return;
  }
  out.push(String(value));
}

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  flatten(values, out);
  return out.join(' ');
}

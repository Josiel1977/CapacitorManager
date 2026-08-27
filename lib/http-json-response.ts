export async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(`${fallbackMessage} O servidor retornou uma resposta vazia (HTTP ${response.status}).`);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new Error(`${fallbackMessage} O servidor retornou uma resposta inválida (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message = body && typeof body === 'object'
      ? ('error' in body && typeof body.error === 'string' ? body.error
        : 'message' in body && typeof body.message === 'string' ? body.message
          : null)
      : null;
    throw new Error(message || `${fallbackMessage} HTTP ${response.status}.`);
  }

  return body as T;
}

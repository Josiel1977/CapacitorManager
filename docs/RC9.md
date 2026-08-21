# CapacitorManager 1.0.0-rc.9

## Correções desta versão

- Relatórios técnicos agora são montados em páginas A4 independentes.
- Cada página possui cabeçalho, rodapé e numeração própria.
- Tabelas são divididas entre páginas por quantidade segura de linhas, evitando cortes no meio do conteúdo.
- O PDF é exportado página por página, em vez de recortar uma única imagem comprida.
- O botão **Login** permanece visível no rodapé do menu; somente a lista de opções rola.
- A tendência histórica passou a ordenar as medições pela data e comparar o afastamento absoluto do valor nominal.

## Validação

- 47 testes automatizados aprovados.
- O ZIP não inclui `.env.local`, `.next` ou `node_modules`.

## Teste recomendado

Gere uma prévia com um cliente que tenha várias medições e exporte o PDF. Confira:

1. numeração contínua das páginas;
2. ausência de linhas cortadas entre duas páginas;
3. cabeçalho e rodapé em todas as páginas;
4. botão Login visível sem rolar a barra lateral.

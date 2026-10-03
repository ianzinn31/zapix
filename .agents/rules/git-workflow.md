# Diretrizes de Git e Sincronização com VPS

Sempre que concluir uma implementação, correção de bug ou melhoria, e sempre que o usuário solicitar commit:
1. **Commit Local:** Faça o `git add` dos arquivos pertinentes e `git commit -m "..."` com mensagem clara e padronizada.
2. **Push Remoto Imediato (Obrigatório):** Execute SEMPRE `git push origin main` logo após o commit. O ambiente de produção/VPS sincroniza diretamente com o repositório GitHub remoto (`origin/main`). Fazer apenas o commit local sem o push quebra o fluxo de deploy da VPS.

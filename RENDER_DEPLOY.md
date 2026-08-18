# Deploy no Render - Guia Completo

## ✅ O que foi corrigido

1. **WebSocket seguro (WSS)**: O cliente agora detecta HTTPS e usa `wss://` em vez de `ws://`
2. **Proxy reverso**: Servidor configurado para confiar no proxy do Render
3. **Transports**: Socket.IO prioriza WebSocket

---

## 🚀 Como usar agora (Online)

### 1. **Host e Espectador estão separados (em PCs diferentes)**

#### Para o **Host** (pessoa que compartilha a tela)
1. Abra: `https://fellastelas.onrender.com/` (sua URL no Render)
2. Escolha **Host**
3. Digite seu nome
4. Clique em **Entrar**
5. Clique em **Compartilhar Tela**
6. Selecione a tela/janela que quer compartilhar
7. Aprove a permissão do navegador

#### Para o **Espectador** (amigos que veem a tela)
1. Abra: `https://fellastelas.onrender.com/` (mesma URL)
2. Escolha **Espectador**
3. Digite seu nome
4. Clique em **Entrar**
5. A tela do host aparece automaticamente

---

## 🔧 Configuração no Render (se não tiver feito)

### Build Command
```bash
npm install && npm install --prefix server && npm install --prefix client && npm run build
```

### Start Command
```bash
npm start
```

### Environment Variables
- `NODE_ENV` = `production`

---

## ⚠️ Limitações (por ser WebRTC P2P em internet)

Seu app usa WebRTC P2P, que funciona bem em **LAN**, mas na internet pode ter problemas:

- ✅ **Renderização geralmente funciona** (sinalização via servidor)
- ⚠️ **Conexão entre host e espectadores pode falhar** se estiverem muito distantes ou atrás de NAT complexo
- 🔒 **Solução para conexão 100% confiável**: Adicionar servidor TURN (custo extra)

### Se a conexão falhar entre host e espectador:
- Tente recarregar a página
- Verifique se ambos estão na mesma rede local (isso sempre funciona)
- Para internet pública confiável, é necessário TURN (solução futura)

---

## 📊 Monitorar o app

No Render dashboard:
1. Vá em **Logs**
2. Veja se há erros de conexão

Comando local para testar:
```bash
# Testar se o servidor está respondendo
curl https://fellastelas.onrender.com/api/info
```

---

## 🔄 Fazer mudanças no código

1. Edite os arquivos localmente
2. Faça commit: `git add -A && git commit -m "sua mensagem"`
3. Push: `git push origin main`
4. Render redeploy automaticamente em ~1 minuto

---

## 📝 Próximas melhorias (opcional)

- [ ] Adicionar TURN server para conexão 100% confiável
- [ ] Limpar Interface para melhor UX online
- [ ] Adicionar histórico de sessões
- [ ] Autenticação (opcional)

---

## ❓ Troubleshooting

### Erro: "Mixed Content - WSS"
✅ **Já corrigido!** Atualize o navegador (hard refresh: Ctrl+Shift+R)

### Espectador não consegue entrar
- [ ] Verifique se o host está "Compartilhando Tela"
- [ ] Verifique o console (F12 → Console) para erros
- [ ] Se estiver em LAN, use o IP local em vez da URL do Render

### Host não consegue compartilhar tela
- Navegador não tem permissão? Verifique em **Configurações do Navegador**
- Tente em outra janela/aba
- Tente outro navegador (Chrome, Edge, Firefox)

---

**Última atualização**: 2026-08-18
**URL de produção**: `https://fellastelas.onrender.com/`

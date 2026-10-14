# 📒 Diário de Bordo — o caderno do seu carro

App gratuito e open source para controlar a manutenção do seu carro: troca de óleo, filtros, pastilhas, correia, pneus, abastecimentos e o histórico completo para mostrar na revenda.

- **Sem cadastro, sem servidor, sem anúncio.** Os dados ficam no seu navegador (`localStorage`).
- **Funciona offline** e pode ser instalado no celular como app (PWA).
- **Zero dependências e sem build.** HTML + CSS + JavaScript puros.

## O que ele faz

| | |
|---|---|
| 🛠️ **Painel** | Itens de manutenção com intervalo por km e/ou meses (vale o que vencer primeiro), barra de progresso e status: *em dia*, *em breve*, *atrasado*. |
| ✓ **Registrar feito** | Um toque grava data, km, valor, oficina e observações, e já recalcula a próxima troca. |
| 📋 **Histórico** | Todos os serviços, inclusive avulsos (barulho, conserto, peça trocada). |
| 📄 **Histórico pra revenda** | Gera uma página limpa pronta para imprimir ou salvar em PDF. |
| ⛽ **Combustível** | Média km/l, custo por km e gasto total. |
| 🚙 **Vários carros** | Alterne entre veículos no topo. |
| 💾 **Backup** | Exporta e importa tudo em um arquivo `.json`. |

## Usar (para qualquer pessoa)

Abra **<https://sonsonm.github.io/diario-de-bordo/>** e, no celular, use **Adicionar à tela inicial**.

## Publicar sua própria cópia no GitHub Pages

1. Crie um repositório no GitHub e envie estes arquivos para a branch `main`.
2. Vá em **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
4. Em um minuto o app estará em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Ou então clique em **Fork** neste repositório e ative o Pages no seu fork.

## Rodar localmente

```bash
python -m http.server 8080
```

Abra <http://localhost:8080>. (Pode abrir o `index.html` direto, mas o modo offline só funciona via http.)

## Estrutura

```
index.html            casca da página
styles.css            visual
app.js                toda a lógica (estado, regras, telas)
sw.js                 service worker (offline)
manifest.webmanifest  instalação como app
icon.svg              ícone
```

Ao publicar uma mudança, aumente o `CACHE` em `sw.js` (`diario-v2`, `diario-v3`…) para que quem já instalou receba a versão nova.

## Como contribuir

Issues e pull requests são bem-vindos. Ideias que ficariam ótimas:

- [ ] Fotos e áudios anexados a cada registro (IndexedDB)
- [ ] Lembretes por notificação
- [ ] Sincronização opcional entre aparelhos
- [ ] Outros idiomas e moedas
- [ ] Modelos de itens por tipo de veículo (moto, diesel, elétrico)
- [ ] Gráficos de gastos por mês

Mantenha o projeto simples: sem framework e sem etapa de build, para qualquer pessoa conseguir abrir o código e mexer.

## Licença

[MIT](LICENSE): use, copie e modifique à vontade.

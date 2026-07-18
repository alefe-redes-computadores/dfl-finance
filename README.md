# 💰 DFL Finance

O **DFL Finance** é uma aplicação de controle financeiro pessoal e empresarial desenvolvida com foco absoluto em uma experiência *mobile-first*, performance otimizada e disponibilidade offline. 

O projeto foi arquitetado para ser um sistema **"local-first"**. Isso significa que a interface do usuário carrega os dados diretamente do armazenamento do dispositivo, garantindo rapidez e navegação sem travamentos, mesmo com conexões de internet instáveis.

## 🚀 Funcionalidades Principais



*   **Gestão de Orçamentos:** Acompanhamento mensal, quinzenal ou semanal com cálculos de projeções inteligentes de consumo.
*   **Controle de Transações:** Registro ágil de receitas (income) e despesas (expense) com suporte a categorização e anexos (recibos).
*   **Gestão de Dívidas:** Monitoramento detalhado de devedores, histórico de pagamentos e envios de lembretes integrados via WhatsApp.
*   **Metas Financeiras:** Acompanhamento de metas de economia com barras de progresso dinâmicas e histórico de contribuições.
*   **Contatos/CRM Financeiro:** Gestão de fornecedores e clientes com vínculo direto às transações.
*   **Modo Offline e PWA:** Funcionalidade de Progressive Web App permitindo a instalação nativa no smartphone e cache de dados via Service Workers.
*   **UX Mobile:** Resposta tátil (Haptic Feedback) e navegação otimizada para o uso com uma só mão.

## 🛠️ Tecnologias Utilizadas

*   **Framework:** [Next.js 14+](https://nextjs.org/) (Utilizando o novo App Router)
*   **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
*   **Banco de Dados/BaaS:** [Supabase](https://supabase.com/)
*   **Ícones:** [Lucide React](https://lucide.dev/)
*   **Manipulação de Datas:** [date-fns](https://date-fns.org/)
*   **Persistência de Dados Local:** IndexedDB (via Dexie.js)
## 🏗️ Arquitetura e Estrutura de Diretórios

O projeto segue a arquitetura **Local-First**. Os *Custom Hooks* (`useLocalData`, `useSafeDb`) priorizam a leitura e gravação no IndexedDB local. Uma fila de sincronização (`syncQueue`) trabalha em segundo plano para enviar os dados ao Supabase assim que a conexão de rede estiver estável.

Abaixo está a estrutura de pastas atual da aplicação:

```text
dfl-finance/
├── public/                 # Assets estáticos e configuração do PWA
│   ├── manifest.json       # Configuração de instalação do PWA
│   └── sw.js               # Service Worker para cache e uso offline
├── src/
│   ├── app/                # Roteamento baseado em arquivos (App Router)
│   │   ├── (app)/          # Grupo de rotas da área autenticada
│   │   │   ├── budgets/    # Telas de controle de orçamentos
│   │   │   ├── contacts/   # Telas de agenda e CRM de contatos
│   │   │   ├── debts/      # Telas de gestão de contas a pagar/receber
│   │   │   ├── goals/      # Telas de metas financeiras
│   │   │   └── transactions/# Telas de lançamentos e extratos
│   │   ├── layout.tsx      # Layout principal da aplicação
│   │   └── page.tsx        # Página inicial / Autenticação
│   ├── components/         # Componentes de UI reutilizáveis
│   │   ├── ContextToggle   # Alternância entre contas (Pessoal/Empresa)
│   │   └── Skeleton        # Componentes de carregamento visual
│   ├── contexts/           # Gerenciamento de estado global (Context API)
│   │   ├── ToastContext    # Sistema de notificações e alertas
│   │   └── AuthContext     # Gerenciamento de sessão do Supabase
│   ├── hooks/              # Regras de negócio encapsuladas
│   │   ├── useLocalData    # Leitura reativa do banco local
│   │   ├── useSafeDb       # Operações seguras de escrita local/nuvem
│   │   └── useHapticFeedback # Vibrações nativas no mobile
│   └── lib/                # Configurações e utilitários da aplicação
│       ├── db.ts           # Configuração do banco de dados local (IndexedDB)
│       ├── iconUtils.ts    # Renderização dinâmica da biblioteca Lucide
│       └── utils.ts        # Funções de formatação (moeda, CNPJ, etc)
├── .env.local              # Variáveis de ambiente secretas (Supabase, URLs)
├── next.config.mjs         # Regras de compilação do Next.js e next-pwa
├── tailwind.config.ts      # Tokens de design e cores do projeto
├── package.json            # Gerenciamento de dependências
└── tsconfig.json           # Tipagem estática do projeto

## ⚙️ Instalação e Configuração

### Pré-requisitos
* Node.js v18 ou superior instalado.
* Chaves de API do Supabase.

### Como rodar o projeto localmente

1. **Clone o repositório:**
    git clone https://github.com/alefe-redes-computadores/dfl-finance.git
    cd dfl-finance

2. **Instale as dependências:**
    npm install

3. **Configure as Variáveis de Ambiente:**
Crie um arquivo `.env.local` na raiz do projeto com as credenciais do seu Supabase:
    NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase_aqui
    NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_aqui

4. **Inicie o servidor de desenvolvimento:**
    npm run dev

Acesse a aplicação no navegador via: http://localhost:3000

## 📱 Fluxo de Desenvolvimento Mobile

Este repositório foi otimizado para manutenção direta via smartphone utilizando o **Termux** e editores mobile nativos (como **Acode** ou **Spck Editor**).

**Comandos úteis para o dia a dia no Termux:**

* Para baixar novidades da nuvem sem sobrescrever configurações locais:
    git pull origin main

* Para enviar alterações feitas pelo celular:
    git add .
    git commit -m "feat: descrição da sua alteração"
    git push origin main

---
*DFL Finance — Controle financeiro local-first desenvolvido para máxima produtividade.*

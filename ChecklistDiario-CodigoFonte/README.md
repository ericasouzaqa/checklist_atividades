# ✅ Checklist Diário

Widget de checklist flutuante para desktop — offline, minimalista e reativo.  
Feito com Electron. Sem servidor, sem nuvem, sem internet. Seus dados ficam no seu computador.

---

## ✨ Funcionalidades

- **Checklist diário** com histórico por data
- **Drag & drop** para reordenar tarefas
- **Filtros de visão** — Hoje, Semana, Mês, Ano ou Período customizado
- **Paleta de cores e texturas** — 6 temas rápidos + cor personalizada + 5 texturas (Glass, Neon, Mármore, Glitter, Gradiente)
- **Exportação** para CSV e Excel (XLSX)
- **Backups automáticos** — ao iniciar e a cada 4 horas, com retenção dos últimos 30 pontos
- **Persistência com recuperação** — arquivo `.bak` e isolamento de dados corrompidos
- **Título editável** — clique no nome para personalizar
- **Iniciar com o Windows** — opção embutida na interface
- **Tooltips** em todos os botões de ação

---

## 🖥️ Requisitos

| Requisito | Versão mínima |
|-----------|---------------|
| Node.js   | 18 ou superior |
| npm       | 8 ou superior  |
| Sistema   | Windows 10/11  |

---

## 🚀 Instalação e execução

```bash
# 1. Clone o repositório
git clone https://github.com/erica-souza/checklist-diario.git
cd checklist-diario

# 2. Instale as dependências
npm install

# 3. Execute em modo desenvolvimento
npm start
```

---

## 📦 Gerar o executável portátil

```bash
npm run build:portable
```

O arquivo `ChecklistDiario_Portatil.exe` será gerado na pasta `dist/`.  
Não precisa de instalação — basta copiar e executar.

> **Nota:** o build requer Windows. Em outros sistemas operacionais,  
> use o `npm start` para rodar em modo desenvolvimento.

---

## 📁 Onde os dados são salvos

Os dados ficam em:

```
C:\Users\<seu-usuário>\AppData\Roaming\checklist-diario-erica\
```

| Arquivo | Descrição |
|---------|-----------|
| `checklist-data.json` | Arquivo principal de dados |
| `checklist-data.json.bak` | Espelho de segurança (atualizado a cada save) |
| `Backups/` | Pasta com até 30 pontos de backup automático |

---

## 🏗️ Estrutura do projeto

```
checklist-diario/
├── main.js          # Processo principal do Electron (janela, IPC, backups)
├── preload.js       # Bridge segura entre main e renderer
├── renderer.js      # Toda a lógica de UI e estado
├── index.html       # Estrutura HTML da interface
├── style.css        # Design system e estilos
├── icon.ico         # Ícone do aplicativo
├── package.json     # Configuração e build
├── .gitignore
└── LICENSE
```

---

## 🛠️ Tecnologias

- [Electron](https://www.electronjs.org/) v31
- [SheetJS (xlsx)](https://sheetjs.com/) para exportação Excel
- JavaScript puro — sem frameworks de UI

---

## 📄 Licença

ISC © [Erica de Souza](https://linkedin.com/in/erica-souza)

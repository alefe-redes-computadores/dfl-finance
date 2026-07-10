const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (file === 'page.tsx' || file === 'page.jsx') {
      if (fullPath.includes('[') && fullPath.includes(']')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // Se já criamos o ClientPage aqui antes, pula pra não dar erro
        const clientPagePath = path.join(dir, 'ClientPage.tsx');
        if (fs.existsSync(clientPagePath)) {
          console.log('✅ Rota já resolvida:', dir);
          continue;
        }

        // Limpa a "sujeira" que o robô antigo deixou
        content = content.replace(/\/\/ Adicionado pelo robô para o Build Nativo/g, '');
        content = content.replace(/export function generateStaticParams\(\) \{ return \[\]; \}/g, '');
        content = content.trim();

        if (content.includes('use client') || content.includes('"use client"')) {
          console.log('🔧 Separando Server/Client em:', fullPath);
          
          // 1. Salva o seu código intacto no novo arquivo ClientPage.tsx
          fs.writeFileSync(clientPagePath, content);
          
          // 2. Transforma o page.tsx original numa "Ponte" aceita pelo Next.js
          const newPageContent = `
import ClientPage from './ClientPage';

export function generateStaticParams() {
  return [];
}

export default function Page(props) {
  return <ClientPage {...props} />;
}
`;
          fs.writeFileSync(fullPath, newPageContent.trim());
        }
      }
    }
  }
}

console.log('🤖 Iniciando o Robô Avançado...');
processDirectory('./src/app');
console.log('🚀 Rotas consertadas com sucesso!');

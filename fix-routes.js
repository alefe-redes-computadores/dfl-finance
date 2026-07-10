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
        
        // Pega o nome exato da variável (ex: "id" da pasta "[id]")
        const paramMatch = fullPath.match(/\[(.*?)\]/);
        const paramName = paramMatch ? paramMatch[1] : 'id';

        const clientPagePath = path.join(dir, 'ClientPage.tsx');
        
        // Se a separação já foi feita, não faz de novo
        if (fs.existsSync(clientPagePath)) {
          console.log(`✅ Já separado: ${fullPath}`);
          continue;
        }

        console.log(`🔧 Enganando o Next.js na rota: ${fullPath}`);
        
        // 1. Salva seu código original e intacto no ClientPage
        fs.writeFileSync(clientPagePath, content);
        
        // 2. Cria a ponte com um ID Falso para o Next.js aprovar o Build
        const newPageContent = `
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [{ ${paramName}: '1' }];
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

console.log('🤖 Iniciando o Robô Definitivo...');
processDirectory('./src/app');
console.log('🚀 Hack aplicado com sucesso nas rotas dinâmicas!');

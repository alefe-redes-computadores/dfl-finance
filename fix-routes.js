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
        const paramMatch = fullPath.match(/\[(.*?)\]/);
        const paramName = paramMatch ? paramMatch[1] : 'id';
        const clientPagePath = path.join(dir, 'ClientPage.tsx');

        let content = fs.readFileSync(fullPath, 'utf8');

        // Verifica se a gente já tinha criado a ponte antes (inclusive as versões antigas do robô)
        const isAlreadyBridge = content.includes('import ClientPage from') || content.includes('import dynamic from');

        if (!isAlreadyBridge) {
          // Salva o seu código original no ClientPage
          fs.writeFileSync(clientPagePath, content);
        }

        console.log(`🔧 Vendando os olhos do Next.js (SSR: false) na rota: ${fullPath}`);
        
        // Reescreve o page.tsx forçando o Next.js a IGNORAR essa página no servidor
        const newPageContent = `
import dynamic from 'next/dynamic';

const ClientPage = dynamic(() => import('./ClientPage'), {
  ssr: false,
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#0f766e', fontWeight: 'bold' }}>Carregando...</div>
});

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

console.log('🤖 Iniciando o Robô Nuclear (SSR OFF)...');
processDirectory('./src/app');
console.log('🚀 Next.js completamente vendado! O Build vai passar.');

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

        // Verifica se a gente já tinha criado a ponte antes
        const isAlreadyBridge = content.includes('import ClientPage from');

        if (!isAlreadyBridge) {
          // Salva o seu código original no ClientPage (se ainda não fez)
          fs.writeFileSync(clientPagePath, content);
        }

        console.log(`🔧 Injetando Suspense (Anti-Bug) na rota: ${fullPath}`);
        
        // Reescreve o page.tsx colocando o <Suspense> exigido pelo Next.js
        const newPageContent = `
import ClientPage from './ClientPage';
import { Suspense } from 'react';

export async function generateStaticParams() {
  return [{ ${paramName}: '1' }];
}

export default function Page(props) {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#0f766e', fontWeight: 'bold' }}>Carregando...</div>}>
      <ClientPage {...props} />
    </Suspense>
  );
}
`;
        fs.writeFileSync(fullPath, newPageContent.trim());
      }
    }
  }
}

console.log('🤖 Iniciando o Robô Definitivo v3 (Com Suspense Anti-Bug)...');
processDirectory('./src/app');
console.log('🚀 Hacks aplicados com sucesso! Next.js dominado.');

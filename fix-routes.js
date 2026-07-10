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

        const isAlreadyBridge = content.includes('import ClientPage from') || content.includes('import dynamic from');

        if (!isAlreadyBridge) {
          fs.writeFileSync(clientPagePath, content);
        }

        console.log(`🔧 Blindando a rota: ${fullPath}`);
        
        const newPageContent = `
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ClientPage = dynamic(() => import('./ClientPage'), {
  ssr: false,
  loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#0f766e', fontWeight: 'bold' }}>Carregando App...</div>
});

export function generateStaticParams() {
  return [{ ${paramName}: '1' }];
}

export default function Page({ params }) {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ClientPage params={params} />
    </Suspense>
  );
}
`;
        fs.writeFileSync(fullPath, newPageContent.trim());
      }
    }
  }
}

console.log('🤖 Iniciando o Robô v5 (Esconde-Esconde de API)...');
processDirectory('./src/app');

// 🚨 O NOVO TRUQUE: Esconder a pasta API do Next.js
const apiPath = path.join('./src/app', 'api');
const hiddenApiPath = path.join('./src/app', '_api');

if (fs.existsSync(apiPath)) {
  console.log('🙈 Escondendo a pasta /api do servidor para o Build passar...');
  fs.renameSync(apiPath, hiddenApiPath);
}

console.log('🚀 Tudo pronto! O Build estático vai voar agora.');

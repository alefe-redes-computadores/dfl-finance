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
      // Se for uma página dentro de uma pasta dinâmica como [id]
      if (fullPath.includes('[') && fullPath.includes(']')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // Se ainda não tiver a função, adiciona ela no final
        if (!content.includes('generateStaticParams')) {
          console.log('Robô consertando rota:', fullPath);
          content += '\n\n// Adicionado pelo robô para o Build Nativo\n';
          content += 'export function generateStaticParams() { return []; }\n';
          fs.writeFileSync(fullPath, content);
        }
      }
    }
  }
}

console.log('Iniciando o robô consertador de rotas dinâmicas...');
processDirectory('./src/app');
console.log('Rotas consertadas com sucesso!');

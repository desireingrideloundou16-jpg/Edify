/** Writes the AI designer's general prompt to docs/prompt-designer-packaging.md (readable copy). */
import fs from "node:fs";
import path from "node:path";
import { DESIGNER_METHOD, DESIGNER_ROLE } from "../src/lib/ai/designerPrompt";
import { PACKAGING_KNOWLEDGE } from "../src/lib/ai/packagingKnowledge";

const doc = `# Prompt général du designer IA d'Edify

Ce texte est envoyé à l'IA (Claude ou Gemini) avant chaque conception de packaging, suivi du catalogue des contenants, des directions artistiques et des polices installées. Il est généré depuis \`src/lib/ai/designerPrompt.ts\` et \`src/lib/ai/packagingKnowledge.ts\` : modifiez ces fichiers, puis relancez \`npx tsx scripts/export-designer-prompt.ts\`.

## Rôle

${DESIGNER_ROLE}

## Méthode

\`\`\`text
${DESIGNER_METHOD}
\`\`\`

## Savoir-faire et réglementation

\`\`\`text
${PACKAGING_KNOWLEDGE.trim()}
\`\`\`
`;
fs.writeFileSync(path.resolve(__dirname, "../docs/prompt-designer-packaging.md"), doc);
console.log("docs/prompt-designer-packaging.md écrit :", doc.length, "caractères");

import { readFileSync, existsSync } from 'node:fs';
import { z } from 'zod';
const schema = z.object({
  version: z.string(),
  questions: z.array(
    z.object({
      id: z.number().int().positive(),
      answer: z.number().min(1).max(3),
      choices: z.array(z.object({ id: z.number(), text: z.string().min(1) })).length(3),
      question: z.string().min(1),
      structure: z.string().min(1),
      category: z.string().min(1),
      type: z.enum(['text', 'image']),
      image: z.string().optional(),
      sourcePage: z.number(),
      fingerprint: z.string(),
    }),
  ),
});
const bank = schema.parse(JSON.parse(readFileSync('public/questions/questions.json', 'utf8')));
if (bank.questions.length !== 1090) throw Error('Incorrect question count');
bank.questions.forEach((q, i) => {
  if (q.id !== i + 1 || q.choices.map((c) => c.id).join() !== '1,2,3')
    throw Error(`Invalid IDs for #${q.id}`);
  if (q.type === 'image' && (!q.image || !existsSync(`public/${q.image}`)))
    throw Error(`Missing image for #${q.id}`);
});
console.log(`Validated ${bank.questions.length} questions and all image paths.`);

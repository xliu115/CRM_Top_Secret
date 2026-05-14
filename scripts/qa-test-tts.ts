import "dotenv/config";
import OpenAI from "openai";

async function main() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  const text = "Morgan, here is your morning briefing.";
  const cases = [
    { name: "tts-1 / no instructions", body: { model: "tts-1", voice: "alloy", input: text } },
    {
      name: "gpt-4o-mini-tts / no instructions",
      body: { model: "gpt-4o-mini-tts", voice: "sage", input: text },
    },
    {
      name: "gpt-4o-mini-tts / with instructions",
      body: {
        model: "gpt-4o-mini-tts",
        voice: "sage",
        input: text,
        instructions: "Speak briskly and warmly.",
      },
    },
  ] as const;

  for (const c of cases) {
    const t0 = Date.now();
    try {
      const r = await openai.audio.speech.create(c.body as Parameters<typeof openai.audio.speech.create>[0]);
      const buf = Buffer.from(await r.arrayBuffer());
      console.log(`OK   ${c.name}  ${buf.length}B  ${Date.now() - t0}ms`);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      console.log(`FAIL ${c.name}  status=${err.status}  ${err.message?.slice(0, 120)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

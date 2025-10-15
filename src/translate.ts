import OpenAI from "openai";

const endpoint = "https://models.github.ai/inference";
const systemPrompt = `
You are a professional technical translator specialized in open-source software changelogs.
Your task is to translate Changelog into the required language.
Requirements:
- Accurate, natural, and concise
- Keeps the tone and style consistent with modern open-source projects
- Does NOT translate version numbers, commit hashes, links, or contributor names
- Keeps markdown formatting exactly the same
- Keeps technical terms like “refactor”, “deps”, “CI”, “chore”, “release” untranslated when appropriate
- Avoids literal translation — prefer fluent, natural phrasing
- If the text contains PR numbers, issue links, or author handles (#123, @user), keep them untouched
`;

export async function translate(content: string, target: string) {
    const token = process.env["API_TOKEN"] || process.env["GITHUB_TOKEN"];
    if (!token) {
        console.warn("No API token available, skipping translation");
        return "";
    }
    const client = new OpenAI({ baseURL: endpoint, apiKey: token });
    const response = await client.chat.completions.create({
        model: "openai/gpt-4.1",
        temperature: 0.3,
        top_p: 1,
        max_tokens: 4096,
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Translate the following changelog content to ${target}: ${content}`,
            },
        ],
    })

    return response.choices[0]?.message?.content?.trim() || "";
}
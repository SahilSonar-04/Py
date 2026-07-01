import crypto from "crypto";

export async function uploadBufferToTransloadit(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const authKey = process.env.TRANSLOADIT_AUTH_KEY;
  const authSecret = process.env.TRANSLOADIT_AUTH_SECRET;

  if (!authKey || !authSecret || authKey.includes("PLACEHOLDER")) {
    throw new Error(
      "TRANSLOADIT_AUTH_KEY / TRANSLOADIT_AUTH_SECRET are not set in this environment. " +
        "Since Trigger.dev's cloud runners don't share a filesystem with Vercel, real " +
        "Transloadit credentials are required for Crop Image to store its output. " +
        "Set these in the Trigger.dev dashboard's Environment Variables (Prod), not just Vercel's."
    );
  }

  const expires = new Date(Date.now() + 5 * 60 * 1000)
    .toISOString()
    .replace(/\.\d+Z$/, "+00:00")
    .replace(/-/g, "/")
    .replace("T", " ");

  const params = JSON.stringify({
    auth: { key: authKey, expires },
    steps: {
      ":original": { robot: "/upload/handle" },
    },
  });

  const signature =
    "sha384:" +
    crypto.createHmac("sha384", authSecret).update(Buffer.from(params, "utf-8")).digest("hex");

  const uploadForm = new FormData();
  uploadForm.append("params", params);
  uploadForm.append("signature", signature);
  uploadForm.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const createRes = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: uploadForm,
  });
  let assembly = await createRes.json();

  if (assembly.error) {
    throw new Error(`Transloadit assembly error: ${assembly.message ?? assembly.error}`);
  }

  const statusUrl = assembly.assembly_ssl_url as string;
  for (let i = 0; i < 15 && (!assembly.uploads || assembly.uploads.length === 0); i++) {
    if (assembly.ok === "ASSEMBLY_ERROR") break;
    await new Promise((r) => setTimeout(r, 500));
    const poll = await fetch(statusUrl);
    assembly = await poll.json();
  }

  const uploaded = assembly.uploads?.[0];
  if (!uploaded?.ssl_url) {
    throw new Error(
      `Transloadit upload finished but returned no file URL: ${assembly.message ?? "unknown error"}`
    );
  }

  return uploaded.ssl_url as string;
}

// base64 strings were used to leak the secrets
export const base64Regex =
  /^(?:[A-Za-z0-9+/]{4}){5,}(?:|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

export function findSecretsInLines(lines, base64Regex) {
  const secrets = [];
          
  for (const line of lines) {
    if (line == "") {
      continue;
    }

    const data = line.split(" ").slice(1).join(" ");

    if (data == undefined) {
      console.warn("Failed to parse log line: " + line);
      continue;
    }

    const match = base64Regex.exec(data);
    if (!match) {
        continue;
    }
    const secret = match[0];

    // Base64 decode the secret
    try {
        const decodedOnce = Buffer.from(secret, "base64").toString();

        const match2 = base64Regex.exec(decodedOnce);
        if (!match2) {
            continue;
        }

        const decoded = Buffer.from(decodedOnce, "base64").toString();

        // json decode it
        try {
            const jsonDecoded = JSON.parse("{" + decoded + "}");
            if (Object.keys(jsonDecoded).length > 0) {
                secrets.push(jsonDecoded);
            }
        } catch (error) {
            continue;
        }
    } catch (error) {
        continue;
    }
  }

  return secrets;
}
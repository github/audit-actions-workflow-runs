
// base64 strings were used to leak the secrets
export const base64Regex1 =
  /^SW[A-Za-z0-9+/]{2}(?:[A-Za-z0-9+/]{4}){15,}(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)\s*$/;

export const base64Regex2 =
  /^I[A-Za-z0-9+/]{3}(?:[A-Za-z0-9+/]{4}){9,}(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)\s*$/;

export function findSecretsInLines(lines) {
  const secrets = [];

  let foundSecrets = false;
          
  for (const line of lines) {
    if (line == "") {
      continue;
    }

    // separate the timestamp from the data
    const data = line.split(" ").slice(1).join(" ");

    if (data == undefined) {
      console.warn("Failed to parse log line: " + line);
      continue;
    }

    const match = base64Regex1.exec(data);
    if (!match) {
        // stop processing the log after the first line that does not match the regex, if we already found secrets
        if (foundSecrets) {
            break
        }
        continue;
    }
    const secret = match[0];

    // Base64 decode the secret
    try {
        const decodedOnce = Buffer.from(secret, "base64").toString();

        const match2 = base64Regex2.exec(decodedOnce);
        if (!match2) {
            console.log("Failed to match base64 data after first decode: " + decodedOnce);
            continue;
        }

        const decoded = Buffer.from(decodedOnce, "base64").toString();

        // json decode it
        try {
            const jsonDecoded = JSON.parse("{" + decoded + "}");
            if (Object.keys(jsonDecoded).length > 0) {
                foundSecrets = true;
                secrets.push(jsonDecoded);
            }
        } catch (error) {
            console.log("Failed to decode JSON data after second decode: " + decoded);
            continue;
        }
    } catch (error) {
        continue;
    }
  }

  return secrets;
}

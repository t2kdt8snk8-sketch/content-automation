import { google } from "googleapis";
import { Readable } from "node:stream";

function parseCredentials() {
  const raw = process.env.GOOGLE_DRIVE_CREDENTIALS;
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as {
      client_email: string;
      private_key: string;
    };
  } catch {
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf-8");
      return JSON.parse(decoded) as {
        client_email: string;
        private_key: string;
      };
    } catch {
      throw new Error(
        "GOOGLE_DRIVE_CREDENTIALS 값이 올바르지 않습니다. 서비스 계정 JSON 또는 그것을 base64로 인코딩한 값을 넣어주세요."
      );
    }
  }
}

export async function uploadPngToDrive(fileName: string, buffer: Buffer) {
  const credentials = parseCredentials();
  if (!credentials) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const response = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: fileName,
      mimeType: "image/png",
      ...(folderId ? { parents: [folderId] } : {}),
    },
    media: {
      mimeType: "image/png",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink",
  });

  return {
    driveFileId: response.data.id ?? undefined,
    driveWebViewLink: response.data.webViewLink ?? undefined,
  };
}

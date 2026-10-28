import { z } from "zod";
import { verifyKarakeepConnection } from "../karakeep.js";
import type {
  CredentialField,
  IntegrationProvider,
  VerifiedAccount,
} from "./index.js";

const credentialsSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
});

export class KarakeepProvider implements IntegrationProvider {
  readonly id = "karakeep";
  readonly displayName = "Karakeep";
  readonly docsUrl = "https://docs.karakeep.app/";
  readonly credentialFields: CredentialField[] = [
    {
      key: "baseUrl",
      label: "Server URL",
      type: "text",
      placeholder: "https://karakeep.example.com",
    },
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      placeholder: "API key",
    },
  ];
  readonly credentialSchema = credentialsSchema;

  async verifyCredentials(credentials: unknown): Promise<VerifiedAccount> {
    const parsed = credentialsSchema.parse(credentials);
    const baseUrl = new URL(parsed.baseUrl).origin;
    await verifyKarakeepConnection(baseUrl, parsed.apiKey);
    return {
      providerAccountId: baseUrl,
      label: new URL(baseUrl).host,
      credentials: { baseUrl, apiKey: parsed.apiKey },
    };
  }
}

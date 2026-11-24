import { MAX_COMPANY_LOGO_BYTES, processCompanyLogo } from "@/lib/company/logo";
import { registrationSchema } from "@/lib/auth/validation";
import { registerCompany } from "@/lib/auth/registration";
import { issueEmailVerification } from "@/lib/auth/email-verification";
import { createMobileSession, mobileBootstrap } from "@/lib/mobile/auth";
import { mobileJson, mobileUnexpected } from "@/lib/mobile/http";
import { consumeRateLimit, requestFingerprint } from "@/lib/security/request";

type RegistrationBody = {
  productEdition?: unknown;
  companyName?: unknown;
  adminName?: unknown;
  adminEmail?: unknown;
  adminPassword?: unknown;
  confirmPassword?: unknown;
  legalConsent?: unknown;
};

export async function POST(request: Request) {
  try {
    const multipart = request.headers
      .get("content-type")
      ?.startsWith("multipart/form-data");
    if (
      multipart &&
      Number(request.headers.get("content-length")) >
        MAX_COMPANY_LOGO_BYTES + 65536
    )
      return mobileJson({ error: "LOGO_INVALID" }, 413);
    let logoFile: File | undefined;
    const json = multipart
      ? await (async () => {
          const form = await request.formData();
          const file = form.get("companyLogo");
          if (file instanceof File && file.size) logoFile = file;
          return {
            ...Object.fromEntries(form),
            legalConsent: form.get("legalConsent") === "true",
          };
        })()
      : await request.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return mobileJson({ error: "INVALID_INPUT" }, 400);
    }
    const raw = json as RegistrationBody;
    if (raw.legalConsent !== true) {
      return mobileJson({ error: "LEGAL_CONSENT_REQUIRED" }, 400);
    }

    const parsed = registrationSchema.safeParse({
      productEdition: raw.productEdition,
      companyName: raw.companyName,
      adminName: raw.adminName,
      adminEmail: raw.adminEmail,
      adminPassword: raw.adminPassword,
      confirmPassword: raw.confirmPassword,
    });
    if (!parsed.success) {
      return mobileJson(
        {
          error: "INVALID_INPUT",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const key = await requestFingerprint(
      "mobile-registration",
      parsed.data.adminEmail,
    );
    if (!(await consumeRateLimit(key, 5, 15 * 60_000))) {
      return mobileJson({ error: "RATE_LIMITED" }, 429);
    }

    const logo = logoFile ? await processCompanyLogo(logoFile) : undefined;
    const { user } = logo
      ? await registerCompany(parsed.data, logo)
      : await registerCompany(parsed.data);
    try {
      await issueEmailVerification(user.id, user.email);
    } catch {
      // Registration remains usable; authenticated resend is available.
    }

    const session = await createMobileSession(
      parsed.data.adminEmail,
      parsed.data.adminPassword,
    );
    return mobileJson(
      {
        accessToken: session.token,
        expiresAt: session.expiresAt,
        bootstrap: await mobileBootstrap(session.user),
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "LOGO_INVALID")
      return mobileJson(
        {
          error: "LOGO_INVALID",
          fieldErrors: {
            companyLogo: ["Choose a valid JPEG, PNG or WebP image up to 5 MB."],
          },
        },
        400,
      );
    if (error instanceof SyntaxError)
      return mobileJson({ error: "INVALID_INPUT" }, 400);
    if (error instanceof Error && error.message === "REGISTRATION_CONFLICT") {
      return mobileJson({ error: "EMAIL_IN_USE" }, 409);
    }
    return mobileUnexpected("MOBILE_REGISTRATION", error);
  }
}

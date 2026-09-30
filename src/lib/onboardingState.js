// What Onboarding.jsx should show for the outcome of completeOnboarding.
// Pure JS so node --test can cover it.
//
// RADAR is sales-led: nobody joins a company on their own. The only way in is
// an admin creating an Employee row with the person's email (createEmployee),
// and completeOnboarding inherits role and company from that row. A person who
// signs up with any other email must see a clear "not associated" screen, not a
// crash and not an access grant. A real failure (network, 5xx) must NOT be
// dressed up as "not associated": the person would go bother their admin for
// something that is only a retry.
export const SUPPORT_EMAIL = "soporte@acaciaco.com.mx";
export const SUPPORT_WHATSAPP_URL = "https://wa.me/524498958291";

// `res` is the axios response (2xx) and `err` the rejection (non-2xx): the
// functions client does not unwrap errors, the body lives in err.response.data.
export function onboardingOutcome({ res, err }) {
  if (err) {
    // axios error, or an SDK-normalized one (status/data at the top level).
    const status = err?.response?.status ?? err?.status;
    const code = err?.response?.data?.error ?? err?.data?.error;
    if (status === 404 && code === "not_found") return "not_associated";
    return "error";
  }
  const data = res?.data;
  if (data?.error === "not_found") return "not_associated";
  if (data?.founder) return "founder";
  return "done";
}

import { sha256, supabaseRequest } from "./supabase-server";

const tokenPattern = /^inv1_[a-f0-9]{64}$/;

export function validToken(token) {
  return typeof token === "string" && tokenPattern.test(token);
}

export async function findInvitation(token) {
  if (!validToken(token)) return null;

  const tokenHash = sha256(token);
  const rows = await supabaseRequest(
    `invitation_tokens?select=id,family_id,invited_guest_count,expires_at,revoked_at,families(display_name),rsvp_responses(status,confirmed_guest_count,optional_message)&token_hash=eq.${tokenHash}&limit=1`
  );
  const invitation = rows?.[0];

  if (!invitation || invitation.revoked_at || (invitation.expires_at && new Date(invitation.expires_at) <= new Date())) {
    return null;
  }

  return invitation;
}

export function invitationPayload(invitation) {
  const response = invitation.rsvp_responses?.[0];
  return {
    familyName: invitation.families.display_name,
    guestCount: invitation.invited_guest_count,
    rsvp: response
      ? {
          status: response.status,
          confirmedGuestCount: response.confirmed_guest_count,
          message: response.optional_message || ""
        }
      : null
  };
}

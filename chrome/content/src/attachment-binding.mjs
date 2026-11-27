import { UI_TEXT } from "./constants.mjs";
import { formatText } from "./localization.mjs";

// A repository belongs to an attachment, not whichever Word file happens to
// be first in its parent item. Inspect all available evidence before writing
// or deleting; legacy records without identities remain readable.
export function inspectAttachmentOwnership(metadata = {}) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { status: "unknown", owner: null, complete: false };
  }
  const versions = Array.isArray(metadata.versions) ? metadata.versions : [];
  const libraryID = bindingPositiveID(metadata.item?.libraryID);
  const top = bindingIdentity(metadata.attachment, libraryID);
  const historical = versions.map((version) => bindingIdentity(version?.zotero, libraryID));
  const identities = [top, ...historical].filter(Boolean);
  const keys = new Set(identities.map((value) => value.attachmentKey).filter(Boolean));
  const ids = new Set(identities.map((value) => value.attachmentID).filter((value) => value !== null));
  const libraries = new Set(identities.map((value) => value.libraryID).filter((value) => value !== null));
  const protection = metadata.legacyAttachmentOwnership;
  let status;
  if (keys.size > 1 || ids.size > 1 || libraries.size > 1) {
    status = "mixed";
  }
  else if (!identities.length) {
    status = versions.length || metadata.attachment || metadata.trackedFile || metadata.lastCheck || metadata.enabled
      ? "unknown" : "unbound";
  }
  else if (keys.size && ids.size && !identities.some((value) => value.attachmentKey && value.attachmentID !== null)) {
    // A key-only record and an unrelated ID-only record cannot prove that they
    // refer to the same attachment without an identity connecting the two.
    status = "unknown";
  }
  else {
    status = "single";
  }
  if (protection) {
    if (protection.status === "mixed") status = "mixed";
    else if (protection.status !== "single") status = "unknown";
  }
  const owner = status === "single" ? {
    attachmentKey: [...keys][0] || "",
    attachmentID: [...ids][0] ?? null,
    libraryID: [...libraries][0] ?? libraryID
  } : null;
  return {
    status,
    owner,
    // Missing historical identity may be inferred for continued legacy use,
    // but must never authorize automatic deletion of the whole repository.
    complete: status === "single" && !!owner.attachmentKey && owner.libraryID !== null
      && historical.every(Boolean) && protection?.complete !== false
  };
}

export function attachmentMatchesOwnership(attachment, ownership) {
  const owner = bindingIdentity(ownership?.owner, bindingPositiveID(ownership?.owner?.libraryID));
  if (ownership?.status !== "single" || !owner || !attachment) return false;
  const candidate = bindingIdentity(attachment, bindingPositiveID(attachment.libraryID));
  if (!candidate) return false;
  if (owner.libraryID !== null && candidate.libraryID !== null && owner.libraryID !== candidate.libraryID) return false;
  if (owner.attachmentKey && candidate.attachmentKey && owner.attachmentKey !== candidate.attachmentKey) return false;
  if (owner.attachmentID !== null && candidate.attachmentID !== null && owner.attachmentID !== candidate.attachmentID) return false;
  return !!((owner.attachmentKey && candidate.attachmentKey === owner.attachmentKey)
    || (owner.attachmentID !== null && candidate.attachmentID === owner.attachmentID));
}

export function ownershipReason(ownership, attachment) {
  if (ownership.status === "mixed") return UI_TEXT.attachmentHistoryMixed;
  if (ownership.status === "unknown") return UI_TEXT.attachmentHistoryUnknown;
  if (ownership.status === "single" && !attachmentMatchesOwnership(attachment, ownership)) {
    return formatText("attachmentHistoryMismatch", {
      attachment: ownership.owner.attachmentKey || ownership.owner.attachmentID
    });
  }
  return "";
}

export function attachmentOwnershipBlocked(ownership, attachment) {
  return ownership.status === "mixed" || ownership.status === "unknown"
    || (ownership.status === "single" && !attachmentMatchesOwnership(attachment, ownership));
}

function bindingIdentity(value, libraryID) {
  if (!value || typeof value !== "object") return null;
  const attachmentKey = typeof value.attachmentKey === "string" ? value.attachmentKey.trim() : "";
  const attachmentID = bindingPositiveID(value.attachmentID);
  if (!attachmentKey && attachmentID === null) return null;
  return { attachmentKey, attachmentID, libraryID: bindingPositiveID(value.libraryID) ?? libraryID };
}

function bindingPositiveID(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

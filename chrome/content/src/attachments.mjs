import { SUPPORTED_EXTENSIONS } from "./constants.mjs";

export function getFileName(filePath) {
  return String(filePath ?? "").split(/[\\/]/).filter(Boolean).pop() ?? "";
}

export function getExtension(filePath) {
  const fileName = getFileName(filePath);
  const index = fileName.lastIndexOf(".");
  if (index <= 0 || index === fileName.length - 1) {
    return "";
  }
  return fileName.slice(index).toLowerCase();
}

export function isManageablePath(filePath) {
  return SUPPORTED_EXTENSIONS.includes(getExtension(filePath));
}

export function buildTrackedFileName(filePath) {
  const extension = getExtension(filePath);
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(`Unsupported manuscript extension: ${extension || "(none)"}`);
  }
  return `document${extension}`;
}

export function sanitizeForPath(value) {
  const sanitized = String(value ?? "unknown")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return sanitized || "unknown";
}

export function buildRepoRelativePath(libraryID, itemKey) {
  return `library-${sanitizeForPath(libraryID)}/item-${sanitizeForPath(itemKey)}`;
}

export class AttachmentFinder {
  constructor({ Zotero }) {
    this.Zotero = Zotero;
  }

  async findManageableAttachment(item) {
    if (!item) {
      return null;
    }

    const candidates = this.getAttachmentCandidates(item);
    for (const attachment of candidates) {
      const filePath = await this.getAttachmentPath(attachment);
      if (!filePath || !isManageablePath(filePath)) {
        continue;
      }

      const owningItem = this.getOwningItem(item, attachment);
      return {
        attachment,
        attachmentID: attachment.id,
        attachmentKey: attachment.key,
        fileName: getFileName(filePath),
        filePath,
        extension: getExtension(filePath),
        item: owningItem,
        itemID: owningItem.id,
        itemKey: owningItem.key,
        libraryID: owningItem.libraryID ?? attachment.libraryID
      };
    }

    return null;
  }

  getAttachmentCandidates(item) {
    if (typeof item.isAttachment === "function" && item.isAttachment()) {
      return [item];
    }

    if (typeof item.getAttachments !== "function") {
      return [];
    }

    return item.getAttachments()
      .map((id) => this.Zotero.Items.get(id))
      .filter(Boolean);
  }

  getOwningItem(item, attachment) {
    if (typeof item?.isAttachment === "function" && item.isAttachment()) {
      const parentID = item.parentItemID ?? item.parentID;
      const parent = parentID ? this.Zotero.Items.get(parentID) : null;
      return parent || attachment || item;
    }
    return item;
  }

  async getAttachmentPath(attachment) {
    if (typeof attachment.getFilePathAsync === "function") {
      return attachment.getFilePathAsync();
    }
    if (typeof attachment.getFilePath === "function") {
      return attachment.getFilePath();
    }
    return null;
  }
}

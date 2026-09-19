import { describe, expect, it } from "vitest";
import { photoKind, readPhoto, safeFilename, PHOTO_LIMIT } from "./media";

const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const file = (bytes: Uint8Array, name = "photo.jpg", type = "image/jpeg") => new File([bytes.slice().buffer as ArrayBuffer], name, { type });

describe("what the bytes really are", () => {
  it("recognises the formats Telegram accepts", () => {
    expect(photoKind(jpeg())).toBe("image/jpeg");
    expect(photoKind(png())).toBe("image/png");
    expect(photoKind(webp())).toBe("image/webp");
  });
  it("refuses anything else, however it was labelled", () => {
    expect(photoKind(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
    expect(photoKind(new TextEncoder().encode("<?php echo 1; ?>"))).toBeNull();
    expect(photoKind(new Uint8Array([]))).toBeNull();
  });
  it("does not trust a declared content type", async () => {
    await expect(readPhoto(file(new TextEncoder().encode("MZ not an image"), "x.png", "image/png"))).rejects.toMatchObject({ status: 415 });
  });
  it("accepts a real image that was labelled wrongly, under the type it actually is", async () => {
    const photo = await readPhoto(file(png(), "shot.jpg", "application/octet-stream"));
    expect(photo?.blob.type).toBe("image/png");
    expect(photo?.filename).toBe("shot.png");
  });
});

describe("reading the upload", () => {
  it("treats no file and an empty file as no photo", async () => {
    expect(await readPhoto(null)).toBeNull();
    expect(await readPhoto("")).toBeNull();
    expect(await readPhoto(file(new Uint8Array([]), "empty.jpg"))).toBeNull();
  });
  it("refuses a file past Telegram's ceiling before reading it", async () => {
    const huge = { size: PHOTO_LIMIT + 1, name: "big.jpg", arrayBuffer: () => { throw new Error("must not be read"); } };
    await expect(readPhoto(huge as unknown as File)).rejects.toMatchObject({ status: 413 });
  });
  it("returns a blob carrying the verified type", async () => {
    const photo = await readPhoto(file(jpeg()));
    expect(photo?.blob.type).toBe("image/jpeg");
    expect(photo?.blob.size).toBe(8);
  });
});

describe("filenames", () => {
  it("strips any path and forces the extension to match the bytes", () => {
    expect(safeFilename("../../etc/passwd", "image/png")).toBe("passwd.png");
    expect(safeFilename("C:\\Users\\me\\cover.jpeg", "image/jpeg")).toBe("cover.jpg");
  });
  it("keeps Persian names and drops anything strange", () => {
    expect(safeFilename("عکس کانال.jpg", "image/jpeg")).toBe("عکس کانال.jpg");
    expect(safeFilename('a"b<c>.png', "image/png")).toBe("abc.png");
  });
  it("always produces a name", () => {
    expect(safeFilename("", "image/webp")).toBe("photo.webp");
    expect(safeFilename(undefined, "image/jpeg")).toBe("photo.jpg");
  });
});

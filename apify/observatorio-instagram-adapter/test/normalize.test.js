import assert from "node:assert/strict";
import test from "node:test";

import { normalizeInstagramPost } from "../src/normalize.js";

test("normaliza una publicación sin inventar métricas ausentes", () => {
  const post = normalizeInstagramPost({
    id: "123",
    shortCode: "ABC",
    caption: "Cuenta pública",
    ownerUsername: "gobiernodechile",
    likesCount: 45,
    latestComments: [{ id: "c1", text: "Buen anuncio", likesCount: 2 }],
  });

  assert.equal(post.platform, "instagram");
  assert.equal(post.url, "https://www.instagram.com/p/ABC/");
  assert.equal(post.likesCount, 45);
  assert.equal(post.commentsCount, null);
  assert.equal(post.followersCount, null);
  assert.equal(post.latestComments[0].text, "Buen anuncio");
});

test("puede excluir comentarios del resultado", () => {
  const post = normalizeInstagramPost(
    { id: "123", comments: [{ id: "c1", text: "Comentario" }] },
    false,
  );

  assert.deepEqual(post.latestComments, []);
});

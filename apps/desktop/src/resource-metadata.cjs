const { parseDocument } = require("yaml");
function metadata(content) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) return { body: content, description: "" };
  try {
    const document = parseDocument(match[1]);
    if (document.errors.length)
      return {
        body: content,
        description: "",
        warning: "资源元数据格式有误，以下保留原文。",
      };
    const value = document.toJS({ maxAliasCount: 10 });
    const description =
      typeof value?.description === "string"
        ? value.description.slice(0, 500)
        : "";
    return { body: content.slice(match[0].length), description };
  } catch {
    return {
      body: content,
      description: "",
      warning: "资源元数据无法解析，以下保留原文。",
    };
  }
}
module.exports = { metadata };

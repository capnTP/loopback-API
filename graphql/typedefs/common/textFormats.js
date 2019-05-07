
const textFormatTypes = `
enum text_format_types {
paragraph
list
listwithicons
}
`;

const listType = `
type listwithicons {
id:ID
icon: String!
title: String!
text: String
}
`;

const stringType = `
type stringType {
id: ID
text: String
}
`;

const textFormats = `
union text_formats = stringType | listwithicons
`;

const textFormat = `
type text_format {
 type: text_format_types,
 title: String,
 content:[text_formats]
}
`;

module.exports = [textFormatTypes, stringType, listType, textFormats, textFormat];


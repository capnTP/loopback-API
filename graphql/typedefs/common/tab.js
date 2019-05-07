
const tabViewItems = `
union tab_items = text_format | Map
`;

const tabs = `
type Tab {
id: ID!
title: String!
data:[tab_items]
}
`;

module.exports = [tabViewItems, tabs];

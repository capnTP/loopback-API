# api

## development
create `<project root>/.env`
```
IS_DISABLE_GRAPHIQL=false
```
running dev server (default port is `3003`)
```
npm ci && npm run dev
```
- swagger: http://localhost:3003/explorer  
- normal GraphiQL: http://localhost:3003/graphql  
- `the-asia-web` GraphiQL: http://localhost:3003/wwwtheasia_graphql  

## environment variables
```
// flag to disable GraphiQL
// default: false
IS_DISABLE_GRAPHIQL=false
```

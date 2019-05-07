# How to automatically update DB from loopback schemas (migration)
There are 2 modes for migration

## migrate
Drop schema objects such as tables, indexes, views, triggers, etc that correspond to model definitions attached to this DataSource instance, specified by the models parameter.

__WARNING__: In many situations, this will destroy data! `autoupdate()` will attempt to preserve data while updating the schema on your target DataSource, but this is not guaranteed to be safe. [see doc](https://apidocs.strongloop.com/loopback-datasource-juggler/#datasource-prototype-automigrate)

## update
Update existing database tables. This method applies only to database connectors.

__WARNING__: `autoupdate()` will attempt to preserve data while updating the schema on your target DataSource, but this is not guaranteed to be safe.
```sh
npm run db-update
```

## How to migrate
- In [./tables.js](./tables.js), add model name like so.
```javascript
module.exports = [
  // ...
  'NewModel'
];
```
- Then run migrate script
 ```sh
 npm run db-migrate
 ```
 or
 ```sh
 npm run db-update
 ```
- If you want the table have initial data (only work for `migrate` mode), go to [./seed.js](./seed.js) and use `createRecords` function to create data like so
```javascript
module.exports = async function seed(app) {
 await createRecords(app, 'NewModel', [
   { ...bla bla bla },
   { ...bla bla bla },
   { ...bla bla bla },
 ]);
};
```

#!/usr/bin/env bash
# prod to dev and shop
DATE=$(date +%Y%m%d_%H%M);
FILENAME="dev_db_$DATE.sql";
DUMP_URL="live.ch5zrtiltjrv.ap-southeast-1.rds.amazonaws.com";
RESTORE_URL="development.ch5zrtiltjrv.ap-southeast-1.rds.amazonaws.com";
DUMP_DB="production";
RESTORE_DB_1="theasia";
RESTORE_DB_2="shop";
PGPASSFILE="`dirname "$0"`/.pgpass";

chmod 600 $PGPASSFILE;

PGPASSFILE=$PGPASSFILE pg_dump -h $DUMP_URL -p 5432 -U root -d $DUMP_DB -Fc -v -f $FILENAME;

echo ">> Temporarily dumped to $FILENAME";

PGPASSFILE=$PGPASSFILE pg_restore -h $RESTORE_URL -p 5432 -U root -d $RESTORE_DB_1 $FILENAME --clean --no-owner --verbose;
PGPASSFILE=$PGPASSFILE pg_restore -h $RESTORE_URL -p 5432 -U root -d $RESTORE_DB_2 $FILENAME --clean --no-owner --verbose;

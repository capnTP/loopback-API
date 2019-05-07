module.exports = function(Regions) {
	Regions.beforeRemote('find', function(ctx, r, next) {
        // if(ctx.args.filter){
        //     ctx.args.filter.include = {
        //         relation: "localization"
        //     };
        // }
        // else {
        //     ctx.args.filter = {
        //         include: {
        //             relation: "localization"
        //         }
        //     }
        // }
        next();
    });
    Regions.beforeRemote('findById', function(ctx, r, next) {
        // if(ctx.args.filter){
        //     ctx.args.filter.include = {
        //         relation: "localization"
        //     };
        // }
        // else {
        //     ctx.args.filter = {
        //         include: {
        //             relation: "localization"
        //         }
        //     }
        // }
        next();
    });
};
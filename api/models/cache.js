function defineModel(api)
{
	var model = api.dbObj.define('Cache', {
		key: { type: api.SequelizeBase.STRING, allowNull: false, defaultValue: null, unique: true, autoIncrement: false},
		value: { type: api.SequelizeBase.STRING, allowNull: false, defaultValue: null, unique: false, autoIncrement: false},
		expireTime: { type: api.SequelizeBase.DATE, allowNull: false, defaultValue: null, unique: false, autoIncrement: false}
	});	
	return model;
}

function defineSeeds(api){
	return null;
}

exports.defineModel = defineModel;
exports.defineSeeds = defineSeeds;
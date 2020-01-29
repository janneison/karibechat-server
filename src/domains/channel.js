import _ from 'lodash'
import {toString} from '../infrastructure/util'
import {ON_ERROR} from '../infrastructure/support/enumeration'
import {ObjectID} from 'mongodb'
import {OrderedMap} from 'immutable'

export default class Channel {

    constructor(app) {
        this.app = app;
        this.channels = new OrderedMap();
    }

    aggregate(query){

        return new Promise((resolve, reject) => {
            this.app.db.collection('channels').aggregate(query, (err, results) => {
                return err ? reject(err) : resolve(results);

            });
        });

    }

    find(query, options = {}){

        return new Promise((resolve, reject) => {

            this.app.db.collection('channels').find(query, options).toArray((err, results) => {
                return err ? reject(err) : resolve(results);
            });

        });
    }
    load(id) {

        return new Promise((resolve, reject) => {

            id = _.toString(id);

            const channelFromCache = this.channels.get(id);

            if (channelFromCache) {
				return resolve(channelFromCache);
            }

            this.findById(id).then((channel) => {

                this.channels = this.channels.set(id, channel);
                return resolve(channel);

            }).catch((err) => {

                return reject(err);
            });

        });

    }

    findById(id){

        return new Promise((resolve, reject) => {


            this.app.db.collection('channels').findOne({_id: new ObjectID(id)}, (err, result) => {
                if(err || !result){
                    return reject(err ? err : ON_ERROR.NOT_FOUND);
                }

                return resolve(result);
            });

        });
    }
    create(valueObject) {

        return new Promise((resolve, reject) => {

            let id = toString(_.get(valueObject, '_id'));
            let idObject = id ? new ObjectID(id) : new ObjectID();
            let members = [];

            _.each(_.get(valueObject, 'members', []), (value, key) => {
                const memberObjectId = new ObjectID(key);
                members.push(memberObjectId);
            });


            let userIdObject = null;

            let userId = _.get(valueObject, 'userId', null);
            if (userId) {
                userIdObject = new ObjectID(userId);
            }
            
            const channel = {
                _id: idObject,
                title: _.get(valueObject, 'title', ''),
                lastMessage: _.get(valueObject, 'lastMessage', ''),
                created: new Date(),
                userId: userIdObject,
                members: members,
            }


            this.app.db.collection('channels').insertOne(channel, (err, info) => {
                if (!err) {
                    const channelId = channel._id.toString();
                    this.channels = this.channels.set(channelId, channel);
                }
                return err ? reject(err) : resolve(channel);
            });

        });

    }
}
import _ from 'lodash'
import {isEmail} from '../infrastructure/util'
import bcrypt from 'bcrypt'
import {ObjectID} from 'mongodb'
import {OrderedMap} from 'immutable'
import {ON_ERROR} from '../infrastructure/support/enumeration'

const saltRound = 10;

export default class User {

    constructor(app) {
        this.app = app;
        this.users = new OrderedMap();
    }

    updateUserStatus(userId, isOnline = false) {

        return new Promise((resolve, reject) => {

            this.users = this.users.update(userId, (user) => {

                if (user) {
                    user.online = isOnline;
                }

                return user;
            });

            const query = {_id: new ObjectID(userId)};
            const updater = {$set: {online: isOnline}};
            this.app.db.collection('users').update(query, updater, (err, info) => {
                return err ? reject(err) : resolve(info);
            });

        });
    }

    find(query = {}, options = {}) {


        return new Promise((resolve, reject) => {
            this.app.db.collection('users').find(query, options).toArray((err, users) => {
                return err ? reject(err) : resolve(users);
            });

        });
    }

    search(value = "") {

        return new Promise((resolve, reject) => {


            const regex = new RegExp(value, 'i');

            const query = {
                $or: [
                    {name: {$regex: regex}},
                    {email: {$regex: regex}},
                ],
            };

            this.app.db.collection('users').find(query, {
                _id: true,
                name: true,
                created: true
            }).toArray((err, results) => {


                if (err || !results || !results.length) {

                    return reject({message: ON_ERROR.USER_NOT_FOUND})
                }

                return resolve(results);
            });


        });
    }

    login(user) {

        const email = _.get(user, 'email', '');
        const password = _.get(user, 'password', '');


        return new Promise((resolve, reject) => {


            if (!password || !email || !isEmail(email)) {
                return reject({message: ON_ERROR.LOGIN});
            }

            this.findUserByEmail(email, (err, result) => {


                if (err) {

                    return reject({message: ON_ERROR.LOGIN});
                }



                const hashPassword = _.get(result, 'password');

                const isMatch = bcrypt.compareSync(password, hashPassword);


                if (!isMatch) {

                    return reject({message: ON_ERROR.LOGIN});
                }


                const userId = result._id;

                this.app.models.token.create(userId).then((token) => {

                    token.user = result;

                    return resolve(token);

                }).catch(err => {

                    return reject({message: ON_ERROR.LOGIN});
                })


            });


        });


    }

    findUserByEmail(email, callback = () => {
    }) {


        this.app.db.collection('users').findOne({email: email}, (err, result) => {

            if (err || !result) {

                return callback({message: ON_ERROR.USER_NOT_FOUND})
            }

            return callback(null, result);

        });

    }

    load(id) {


        id = `${id}`;

        return new Promise((resolve, reject) => {


            const userInCache = this.users.get(id);


            if (userInCache) {
                return resolve(userInCache);
            }

            this.findUserById(id, (err, user) => {

                if (!err && user) {


                    this.users = this.users.set(id, user);
                }

                return err ? reject(err) : resolve(user);

            })


        })
    }

    findUserById(id, callback = () => {
    }) {


        if (!id) {
            return callback({message: ON_ERROR.USER_NOT_FOUND}, null);
        }


        const userId = new ObjectID(id);

        this.app.db.collection('users').findOne({_id: userId}, (err, result) => {


            if (err || !result) {

                return callback({message: ON_ERROR.USER_NOT_FOUND});
            }
            return callback(null, result);

        });
    }

    beforeSave(user, callback = () => {
    }) {


        let errors = [];


        const fields = ['name', 'email', 'password'];
        const validations = {
            name: {
                errorMesage: 'Name is required',
                do: () => {

                    const name = _.get(user, 'name', '');

                    return name.length;
                }
            },
            email: {
                errorMesage: 'Email is not correct',
                do: () => {

                    const email = _.get(user, 'email', '');

                    if (!email.length || !isEmail(email)) {
                        return false;
                    }


                    return true;
                }
            },
            password: {
                errorMesage: 'Password is required and more than 3 characters',
                do: () => {
                    const password = _.get(user, 'password', '');

                    if (!password.length || password.length < 3) {

                        return false;
                    }

                    return true;
                }
            }
        }

        fields.forEach((field) => {


            const fieldValidation = _.get(validations, field);

            if (fieldValidation) {


                const isValid = fieldValidation.do();
                const msg = fieldValidation.errorMesage;

                if (!isValid) {
                    errors.push(msg);
                }
            }


        });

        if (errors.length) {

            const err = _.join(errors, ',');
            return callback(err, null);
        }

       
        const email = _.toLower(_.trim(_.get(user, 'email', '')));

        this.app.db.collection('users').findOne({email: email}, (err, result) => {

            if (err || result) {
                return callback({message: ON_ERROR.MAIL}, null);
            }


            
            const password = _.get(user, 'password');
            const hashPassword = bcrypt.hashSync(password, saltRound);

            const userFormatted = {
                name: `${_.trim(_.get(user, 'name'))}`,
                email: email,
                password: hashPassword,
                created: new Date(),
            };


            return callback(null, userFormatted);


        });


    }

    create(user) {

        const db = this.app.db;

        console.log("User:", user);

        return new Promise((resolve, reject) => {


            this.beforeSave(user, (err, user) => {


                console.log("After validation: ", err, user);


                if (err) {
                    return reject(err);
                }

                db.collection('users').insertOne(user, (err, info) => {


                    if (err) {
                        return reject({message: "An error saving user."});
                    }


                    const userId = _.get(user, '_id').toString(); 

                    this.users = this.users.set(userId, user);

                    return resolve(user);

                });

            });

        });
    }
}
const mysql = require('mysql');
const util = require('util');
const configFile = require('../config.json');
const conn = mysql.createPool({
  host: configFile.DB_URL,
  user: configFile.DB_USER,
  password: configFile.DB_PASS,
  database: configFile.DB_NAME
});

const query = util.promisify(conn.query).bind(conn);

exports.queryUser = async (email) => {
  let sql = `SELECT * from users WHERE email = "${email}"`;
  let result = await query(sql);
  if (result.length >= 1) {
      return { 'result': result , 'userExist': true }
  } else {
      return { 'result': result , 'userExist': false }
  }
}

exports.queryUsers = async (offset, limit) => {

  let sql;
  let total_count = `SELECT COUNT(id) AS pages FROM users`;
  let count_result = await query(total_count);
  limit = limit ? limit : 10;
  
  if (!offset) {
      sql = `SELECT * from users`;
  } else {
      offset = offset ? offset - 1 : 0;
      sql = `SELECT * from users LIMIT ${limit} OFFSET ${offset}`;
  }
  
  let result = await query(sql);

  if (result.length >= 1) {
      count_result[0]['users'] = result;
      return count_result
  } else {
      count_result[0]['users'] = [];
      return count_result
  }
}

exports.userStatistic = async (offset, limit) => {

  // query all register users
  let total_count = `SELECT COUNT(id) AS users FROM users`;
  let count_result = await query(total_count);

 // query today online user
  let online_users_sql = `SELECT COUNT(DISTINCT id) AS online from users WHERE DATE(last_session) = CURRENT_DATE()`;
  let result_online_users = await query(online_users_sql);
  result_online_users = result_online_users[0]['online'] ? result_online_users[0]['online'] : 0; 
  count_result[0]['online_today'] = result_online_users;

  // query 7day online user
  let online7d_users_sql = `SELECT COUNT(DISTINCT id) AS online7d from users WHERE last_session > now() - INTERVAL 7 day`;
  let result_online7d_users = await query(online7d_users_sql);
  result_online7d_users = result_online7d_users[0]['online7d'] ? result_online7d_users[0]['online7d'] : 0; 
  count_result[0]['online7d'] = result_online7d_users;

  return count_result;

}


exports.createUser = (data, verifiedCode) => {

  let sql = `INSERT INTO users(name, picture, email, sub, verified_code) VALUES ("${data['name']}", "xxxx", "${data['email']}", "${data['sub']}", "${verifiedCode}")`;
  query(sql, function (err, result) {
    if (err) throw err;
    console.log("User created");
  });

}

exports.updateUser = ( data ) => {

  logged_in =  data['logged_in'] ? data['logged_in'] + 1 : 1;
  last_session = new Date();
  let sql = `UPDATE users SET logged_in = ${logged_in}, last_session = NOW() WHERE id = ${data['id']} `;
  query(sql, function (err, result) {
    if (err) throw err;
    console.log("User updated!");
  });

}

exports.updateUserName = async ( id, name ) => {
    let sql = `UPDATE users SET name = "${name}" WHERE id = ${id} `;
    let result = await query(sql);
    return { 'message': 'Update Success'}
}


exports.activateUser = async ( email , code) => {
  
  let sql = `SELECT * from users WHERE email = "${email}" AND verified_code= "${code}"`;
  let result = await query(sql);
  if (result.length >= 1) {
      let updateSQL = `UPDATE users SET email_verified = 1 WHERE id = ${result[0]['id']} `;
      query(updateSQL, function (err, result) {
        if (err) throw err;
        console.log("User updated!");
      });
  } else {
      return { 'message': 'This Activation Code is Invalid !' }
  }
}
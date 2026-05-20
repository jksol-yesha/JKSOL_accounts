const axios = require('axios');
axios.post('http://localhost:8100/api/auth/refresh', { refreshToken: "dummy" })
  .then(res => console.log(res.data))
  .catch(err => console.log(err.response ? err.response.data : err.message));

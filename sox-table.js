module.exports = function(RED) {
  function LowerCaseNode(config) {
      RED.nodes.createNode(this,config);
      this.prefix = config.prefix;
      var node = this;
      node.on('input', function(msg) {
          msg.payload = node.prefix + msg.payload.toLowerCase();
          node.send(msg);
      });
  }
  RED.nodes.registerType("sox-table",LowerCaseNode);
}
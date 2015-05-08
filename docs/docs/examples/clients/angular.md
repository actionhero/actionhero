---
layout: docs
title: Documentation - Example Angular Clients
---

# Example Angular Clients

## HTTP

{% highlight html %}
<html>
  <head>
    <script src="//ajax.googleapis.com/ajax/libs/angularjs/1.2.25/angular.min.js"></script>
    <script type="text/javascript">

      var app = angular.module('actionheroDocumentationApp', []);
      
      app.controller('actionsController', function($scope, Actions) {
        $scope.actions = new Actions();
        $scope.actions.showDocumentation();
      });

      app.factory('Actions', function($http){
        var Actions = function(){
          this.actions = {}
          this.loaded  = false;
        };

        Actions.prototype.showDocumentation = function(){
          var self = this;
          self.loaded = false;
          var url = '/api/showDocumentation?callback=JSON_CALLBACK';
          $http.jsonp(url).success(function(data){
            self.actions = data.documentation;
            self.loaded = true;
          });
        }

        return Actions;
      });

    </script>
  </head>

  <body ng-app="actionheroDocumentationApp">
    <table border="1" ng-controller="actionsController">
      <thead>
        <tr><th colspan="6">Actionhero APIs</th></tr>
        <tr>
          <td><strong>name</strong></td>
          <td><strong>version</strong></td>
          <td><strong>description</strong></td>
          <td><strong>required</strong></td>
          <td><strong>optional</strong></td>
          <td><strong>outputExample</strong></td>
        </tr>
      </thead>
      <tbody ng-show="actions.loaded">
        <tr ng-repeat="actionCollection in actions.actions">
          <td>{{ actionCollection['1'].name }}</td>
          <td>{{ actionCollection['1'].version }}</td>
          <td>{{ actionCollection['1'].description }}</td>
          <td>{{ actionCollection['1'].inputs.required }}</td>
          <td>{{ actionCollection['1'].inputs.optional }}</td>
          <td>{{ actionCollection['1'].outputExample }}</td>
        </tr>
      </tbody>
      <tbody ng-show="!actions.loaded">
        <tr >
          <td colspan="6">loading...</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
{% endhighlight %}

## WebSocket with actionheroClient

{% highlight html %}
<html>
  <head>
    <script src="//ajax.googleapis.com/ajax/libs/angularjs/1.2.25/angular.min.js"></script>
    <script type="text/javascript" src="/public/javascript/actionheroClient.js"></script>
    <script type="text/javascript">

      var app = angular.module('actionheroChat', []);
      var rooms = ['defaultRoom']
      
      app.controller('chatController', function($scope, ChatClient){
        $scope.chatClient = new ChatClient(function(){
          $scope.$apply();
        });
        $scope.chatClient.connect();
        
        $scope.inputMessage = {message: 'hi'};
        
        $scope.say = function(){
          $scope.chatClient.say($scope.inputMessage.message)
          $scope.inputMessage.message = '';
        }
      });

      app.factory('ChatClient', function(){
        var ChatClient = function(callback){
          var self = this;

          self.client = new ActionheroClient();
          self.messages = [];
          self.error = null;
          self.rooms = rooms;
          self.connected = false;
          self.callback = callback;

          self.client.on('connected',    function(){ self.connected = true;  self.callback(); })
          self.client.on('disconnected', function(){ self.connected = false; self.callback(); })
          // self.client.on('message',      function(message){ console.log(message) })
          self.client.on('alert',        function(message){ window.alert( JSON.stringify(message) ) })
          self.client.on('api',          function(message){ window.alert( JSON.stringify(message) ) })
          self.client.on('say',          function(message){ 
            self.messages.push(message);
            self.callback();
          })
        };

        ChatClient.prototype.connect = function(){
          var self = this;

          self.client.connect(function(error, details){
            if(error){ self.error = error; }
            else{
              self.details = details;
              self.rooms.forEach(function(room){
                self.client.roomAdd(room);
              });
            }
          });
        }

        ChatClient.prototype.say = function(message){
          var self = this;
          self.client.say(self.client.rooms[0], message);
          self.messages.push({
            sentAt: new Date().getTime(),
            message: message,
            from: '*me*',
          });
        }

        return ChatClient;
      });

    </script>
  </head>

  <body ng-app="actionheroChat">
  <div ng-controller="chatController">
    <div>connected: {{ chatClient.connected }}</div>
    <div>
      <form name="myForm">
        say: <input type="text" name="inputMessage" ng-model="inputMessage.message" ng-minlength="1" ng-maxlength="20">
        <button ng-click="say()">say</button>
      </form>
    </div>
    <table border="1">
      <thead>
        <tr><th colspan="6">Chat</th></tr>
        <tr>
          <td><strong>Who</strong></td>
          <td><strong>When</strong></td>
          <td><strong>Message</strong></td>
        </tr>
      </thead>
      <tbody>
        <tr ng-repeat="message in chatClient.messages">
          <td>{{ message.from }}</td>
          <td>{{ message.sentAt }}</td>
          <td>{{ message.message }}</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
{% endhighlight %}
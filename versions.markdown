# Action Hero API Versions

# Version 0.1.5

**Summary:** This release contains a number of fixes for socket clients and some minor task updates.

**Details:**

* Contexts
	* When connected via Socket, knowing the context of a message you receive is important.  All messages sent back to the client should include `context` in the JSON block returned.  
	* For example, by default all actions set a context of "response" indicating that the message being sent to the client is response to a request they sent.  Messages sent by a user via the 'say' command have the context of `user` indicating they came form a user.  Every minute a ping is sent from the server to keep the TCP connection alive and send the current time.  This message has the context of `api`.  Messages resulting from data sent to the api (like an action) will have the `response` context.
	* Be sure to set the context of anything you send!  Actions will always have the `response` context set to them by default.
* Keep Alive
	* A new default task now will send a 'keep alive' message to each connected socket connection.  This will help with TCP timeouts and will broadcast the server time each task cycle( default 1 min ). 
	* Per the above, the message has the `api` context.
* paramsView and paramView
	* params are now passed back wrapped in a `params` object.
* Response Counts
	* Socket connections will have every message sent to them counted, and every message sent will have the `messageCount` value set.  This will help clients keep messages in order.
* Better client id hashes
	* Every socket client has an `connection.id` set for them.  This is used by the `say` command and should be used by any other method which needs to identify one user to another.  This way, the user's IP and port can be kept secret, but you can have a unique id for each user.  Updates to how this hash is generated (now via MD5).
* Minor refactoring to the task framework to add task.log() as a method to help with formatted output.
* The task to clean the log file will now inspect every file in ./logs/ to check if the files have gotten too large.
* Documentation Updates
	Every 
	* This file!
	* readme.markdown
	* project website (branch gh-pages)

## Versions <= 0.1.4
Sorry, I wasn't keeping good notes :(
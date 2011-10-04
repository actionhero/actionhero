SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";

delimiter $$

CREATE TABLE `cache` (
  `Key` varchar(255) NOT NULL,
  `Value` text NOT NULL,
  `ExpireTime` int(11) NOT NULL,
  KEY `Key` (`Key`),
  KEY `ExpireTime` (`ExpireTime`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8$$

delimiter $$

CREATE TABLE `developers` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `DeveloperID` varchar(32) NOT NULL,
  `APIKey` varchar(32) NOT NULL,
  `UserActions` tinyint(1) NOT NULL,
  `IsAdmin` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `DeveloperID` (`DeveloperID`),
  UNIQUE KEY `APIKey` (`APIKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8$$

delimiter $$

CREATE TABLE `lobbies` (
  `LobbyID` int(11) NOT NULL AUTO_INCREMENT,
  `LobbyKey` varchar(45) NOT NULL,
  `LobbyName` varchar(45) NOT NULL,
  `TimeStamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`LobbyID`),
  UNIQUE KEY `LobbyKey_UNIQUE` (`LobbyKey`),
  UNIQUE KEY `LobyName_UNIQUE` (`LobbyName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8$$

delimiter $$

CREATE TABLE `log` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `IP` varchar(255) NOT NULL,
  `TimeStamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `Action` varchar(255) NOT NULL,
  `ERROR` varchar(255) NOT NULL,
  `APIKey` varchar(32) NOT NULL,
  `DeveloperID` varchar(32) NOT NULL,
  `Params` text NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IP` (`IP`),
  KEY `TimeStamp` (`TimeStamp`),
  KEY `Action` (`Action`),
  KEY `Error` (`ERROR`),
  KEY `APIKey` (`APIKey`),
  KEY `DeveloperID` (`DeveloperID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8$$

delimiter $$

CREATE TABLE `messages` (
  `MessageID` int(11) NOT NULL AUTO_INCREMENT,
  `LobbyID` int(11) NOT NULL,
  `Speaker` varchar(45) NOT NULL,
  `Message` text NOT NULL,
  `Timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`MessageID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8$$

delimiter $$

CREATE TABLE `sessions` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `KEY` varchar(128) NOT NULL,
  `DATA` text NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `KEY` (`KEY`),
  KEY `created_at` (`created_at`),
  KEY `updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8$$

delimiter $$

CREATE TABLE `users` (
  `UserID` int(11) NOT NULL AUTO_INCREMENT,
  `FirstName` varchar(32) NOT NULL,
  `LastName` varchar(32) NOT NULL,
  `PhoneNumber` varchar(32) DEFAULT NULL,
  `Gender` text,
  `ScreenName` varchar(32) NOT NULL,
  `EMail` varchar(255) NOT NULL,
  `Birthday` date DEFAULT NULL,
  `PasswordHash` varchar(32) NOT NULL,
  `Salt` varchar(32) NOT NULL,
  `Joined` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`UserID`),
  UNIQUE KEY `ScreenName` (`ScreenName`),
  UNIQUE KEY `EMail` (`EMail`),
  UNIQUE KEY `PasswordHash` (`PasswordHash`),
  UNIQUE KEY `PhoneNumber` (`PhoneNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8$$


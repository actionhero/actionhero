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


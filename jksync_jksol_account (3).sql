-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: May 26, 2026 at 06:26 AM
-- Server version: 10.6.26-MariaDB
-- PHP Version: 8.4.21

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `jksync_jksol_account`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL,
  `branch_id` bigint(20) UNSIGNED DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `account_type` int(11) NOT NULL,
  `subtype` int(11) DEFAULT NULL,
  `opening_balance` decimal(18,2) NOT NULL DEFAULT 0.00,
  `opening_balance_date` date NOT NULL,
  `account_holder_name` varchar(150) NOT NULL,
  `bank_name` varchar(150) NOT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `ifsc` varchar(20) DEFAULT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `bank_branch_name` varchar(120) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `currency_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `accounts`
--

INSERT INTO `accounts` (`id`, `org_id`, `branch_id`, `name`, `account_type`, `subtype`, `opening_balance`, `opening_balance_date`, `account_holder_name`, `bank_name`, `account_number`, `ifsc`, `zip_code`, `bank_branch_name`, `description`, `currency_id`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, NULL, 'Cash', 1, 13, 0.00, '2026-04-01', '', '', NULL, NULL, NULL, NULL, NULL, 2, 1, 3, NULL, NULL),
(2, 1, 3, 'Jksol HDFC-777', 1, 12, 85293518.48, '2026-03-01', 'Jksol Infotech LLP', 'HDFC Bank', '99999737372777', 'HDFC0004693', 'HDFCINBBXXX', 'SARTHANA CHOKDI BRANCH', '', 7, 1, 3, NULL, NULL),
(3, 1, NULL, 'NJ India', 1, 14, 0.00, '2026-04-02', '', '', NULL, NULL, NULL, NULL, '', 2, 1, 3, NULL, NULL),
(5, 1, NULL, 'JKsol ICICI-215', 1, 12, 705196.90, '2026-03-01', '', '', '183705501215', 'ICIC0001837', 'ICICINBBNRI', 'L.P Savani Road', NULL, 2, 1, 5, NULL, NULL),
(6, 1, NULL, 'Wio Bank', 1, 12, 0.00, '2026-04-06', 'NEON INFOTECH FZ-LLC', 'wio', '87878787878', 'HDFC0004693', 'HDFCINBBXXX', 'SARTHANACHOKDIBRANCH', '', 1, 1, 3, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL,
  `entity` varchar(50) NOT NULL,
  `entity_id` bigint(20) UNSIGNED DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `old_value_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_value_json`)),
  `new_value_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_value_json`)),
  `action_by` bigint(20) UNSIGNED NOT NULL,
  `action_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `org_id`, `entity`, `entity_id`, `action`, `old_value_json`, `new_value_json`, `action_by`, `action_at`) VALUES
(1, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-02 03:20:31'),
(2, 1, 'user', 3, 'ADD_OWNER', NULL, '{\"email\":\"ronak@jksol.com\"}', 1, '2026-04-02 03:27:10'),
(3, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-04-02 03:31:32'),
(4, 1, 'user', 5, 'ADD_OWNER', NULL, '{\"email\":\"jksol.jatin@gmail.com\"}', 1, '2026-04-02 03:35:04'),
(5, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-02 03:37:49'),
(6, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-04-02 03:57:26'),
(7, 1, 'branch', 2, 'create', NULL, '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"currencyCode\":\"INR\",\"country\":\"India\",\"status\":1,\"createdAt\":\"2026-04-02T03:59:59.000Z\",\"updatedAt\":null}', 3, '2026-04-02 03:59:59'),
(8, 1, 'branch', 3, 'create', NULL, '{\"id\":3,\"orgId\":1,\"name\":\"Neon Infotech FZ-LLC\",\"currencyCode\":\"AED\",\"country\":\"United Arab Emirates\",\"status\":1,\"createdAt\":\"2026-04-02T04:00:25.000Z\",\"updatedAt\":null}', 3, '2026-04-02 04:00:25'),
(9, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-02 04:01:22'),
(10, 1, 'account', 1, 'create', NULL, '{\"id\":1,\"orgId\":1,\"name\":\"Cash\",\"accountType\":1,\"subtype\":13,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-01\",\"accountNumber\":null,\"currencyId\":2,\"ifsc\":null,\"zipCode\":null,\"bankBranchName\":null,\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:02:11'),
(11, 1, 'account', 2, 'create', NULL, '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:04:16'),
(12, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":2,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:06:21'),
(13, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":2,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:06:25'),
(14, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:06:25'),
(15, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:08:09'),
(16, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":2,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:08:27'),
(17, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":2,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":2,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:08:27'),
(18, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":2,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:08:29'),
(19, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:08:29'),
(20, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 04:23:51'),
(21, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-02 04:33:52'),
(22, 1, 'user', 10, 'ADD_OWNER', NULL, '{\"email\":\"fghfgh\"}', 5, '2026-04-02 04:34:24'),
(23, 1, 'branch', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"currencyCode\":\"INR\",\"country\":\"India\",\"status\":1,\"createdAt\":\"2026-04-02T03:59:59.000Z\",\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"currencyCode\":\"INR\",\"country\":\"India\",\"status\":2,\"createdAt\":\"2026-04-02T03:59:59.000Z\",\"updatedAt\":\"2026-04-02T04:35:11.000Z\"}', 5, '2026-04-02 04:35:11'),
(24, 1, 'branch', 3, 'update', '{\"id\":3,\"orgId\":1,\"name\":\"Neon Infotech FZ-LLC\",\"currencyCode\":\"AED\",\"country\":\"United Arab Emirates\",\"status\":1,\"createdAt\":\"2026-04-02T04:00:25.000Z\",\"updatedAt\":null}', '{\"id\":3,\"orgId\":1,\"name\":\"Neon Infotech FZ-LLC\",\"currencyCode\":\"AED\",\"country\":\"United Arab Emirates\",\"status\":2,\"createdAt\":\"2026-04-02T04:00:25.000Z\",\"updatedAt\":\"2026-04-02T04:35:32.000Z\"}', 5, '2026-04-02 04:35:32'),
(25, 1, 'branch', 1, 'delete', '{\"id\":1,\"orgId\":1,\"name\":\"Surat\",\"currencyCode\":\"INR\",\"country\":\"IN\",\"status\":1,\"createdAt\":\"2026-04-02T03:19:33.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 04:35:58'),
(26, 1, 'branch', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"currencyCode\":\"INR\",\"country\":\"India\",\"status\":2,\"createdAt\":\"2026-04-02T03:59:59.000Z\",\"updatedAt\":\"2026-04-02T04:35:11.000Z\"}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol Infotech LLP\",\"currencyCode\":\"INR\",\"country\":\"India\",\"status\":1,\"createdAt\":\"2026-04-02T03:59:59.000Z\",\"updatedAt\":\"2026-04-02T04:36:20.000Z\"}', 5, '2026-04-02 04:36:20'),
(27, 1, 'branch', 3, 'update', '{\"id\":3,\"orgId\":1,\"name\":\"Neon Infotech FZ-LLC\",\"currencyCode\":\"AED\",\"country\":\"United Arab Emirates\",\"status\":2,\"createdAt\":\"2026-04-02T04:00:25.000Z\",\"updatedAt\":\"2026-04-02T04:35:32.000Z\"}', '{\"id\":3,\"orgId\":1,\"name\":\"Neon Infotech FZ-LLC\",\"currencyCode\":\"AED\",\"country\":\"United Arab Emirates\",\"status\":1,\"createdAt\":\"2026-04-02T04:00:25.000Z\",\"updatedAt\":\"2026-04-02T04:36:21.000Z\"}', 5, '2026-04-02 04:36:21'),
(28, 1, 'branch', 3, 'update', '{\"id\":3,\"orgId\":1,\"name\":\"Neon Infotech FZ-LLC\",\"currencyCode\":\"AED\",\"country\":\"United Arab Emirates\",\"status\":1,\"createdAt\":\"2026-04-02T04:00:25.000Z\",\"updatedAt\":\"2026-04-02T04:36:21.000Z\"}', '{\"id\":3,\"orgId\":1,\"name\":\"Neon Infotech FZ-LLC\",\"currencyCode\":\"AED\",\"country\":\"United Arab Emirates\",\"status\":1,\"createdAt\":\"2026-04-02T04:00:25.000Z\",\"updatedAt\":\"2026-04-02T04:36:21.000Z\"}', 5, '2026-04-02 04:36:28'),
(29, 1, 'category', 1, 'create', NULL, '{\"name\":\"Office Cleaning\",\"txnType\":\"expense\",\"orgId\":1}', 3, '2026-04-02 09:57:30'),
(30, 1, 'category', 2, 'create', NULL, '{\"name\":\"Stationary\",\"txnType\":\"expense\",\"orgId\":1}', 3, '2026-04-02 09:57:58'),
(31, 1, 'category', 4, 'create', NULL, '{\"name\":\"Google Admob\",\"txnType\":\"income\",\"orgId\":1}', 3, '2026-04-02 09:58:18'),
(32, 1, 'category', 5, 'create', NULL, '{\"name\":\"Apple Inapp\",\"txnType\":\"income\",\"orgId\":1}', 3, '2026-04-02 09:58:29'),
(33, 1, 'category', 6, 'create', NULL, '{\"name\":\"Employee Salary\",\"txnType\":\"expense\",\"orgId\":1}', 3, '2026-04-02 09:59:15'),
(34, 1, 'subcategory', 1, 'create', NULL, '{\"id\":1,\"categoryId\":6,\"name\":\"Employee\",\"categoryName\":\"Employee Salary\"}', 3, '2026-04-02 09:59:35'),
(35, 1, 'subcategory', 2, 'create', NULL, '{\"id\":2,\"categoryId\":6,\"name\":\"Office Peon\",\"categoryName\":\"Employee Salary\"}', 3, '2026-04-02 09:59:48'),
(36, 1, 'subcategory', 3, 'create', NULL, '{\"id\":3,\"categoryId\":1,\"name\":\"Handwash\",\"categoryName\":\"Office Cleaning\"}', 3, '2026-04-02 09:59:58'),
(37, 1, 'subcategory', 2, 'update', '{\"id\":2,\"categoryId\":6,\"name\":\"Office Peon\",\"status\":1,\"createdAt\":\"2026-04-02T09:59:48.000Z\",\"categoryName\":\"Employee Salary\"}', '{\"id\":2,\"categoryId\":6,\"name\":\"Office Peon\",\"status\":2,\"createdAt\":\"2026-04-02T09:59:48.000Z\",\"categoryName\":\"Employee Salary\"}', 3, '2026-04-02 10:00:08'),
(38, 1, 'subcategory', 2, 'update', '{\"id\":2,\"categoryId\":6,\"name\":\"Office Peon\",\"status\":2,\"createdAt\":\"2026-04-02T09:59:48.000Z\",\"categoryName\":\"Employee Salary\"}', '{\"id\":2,\"categoryId\":6,\"name\":\"Office Peon\",\"status\":1,\"createdAt\":\"2026-04-02T09:59:48.000Z\",\"categoryName\":\"Employee Salary\"}', 3, '2026-04-02 10:00:11'),
(39, 1, 'party', 1, 'create', NULL, '{\"id\":1,\"orgId\":1,\"companyName\":\"Google Asia\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:04:26.000Z\",\"updatedAt\":null}', 3, '2026-04-02 10:04:26'),
(40, 1, 'party', 2, 'create', NULL, '{\"id\":2,\"orgId\":1,\"companyName\":\"ronak\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"24AXMPV5554H1ZY\",\"gstName\":\"ronak\",\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:04:56.000Z\",\"updatedAt\":null}', 3, '2026-04-02 10:04:56'),
(41, 1, 'transaction', 1, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"Google Asia\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":1,\"contactId\":1,\"categoryId\":4,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"3500000\",\"amountBase\":\"3500000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":1,\"gstType\":1,\"gstRate\":\"18\",\"cgstAmount\":\"315000\",\"sgstAmount\":\"315000\",\"igstAmount\":\"0\",\"gstTotal\":\"630000\",\"finalAmount\":\"4130000\",\"currencyId\":2},\"entries\":[{\"transactionId\":1,\"accountId\":2,\"debit\":\"4130000.00\",\"credit\":\"0.00\",\"description\":\"Deposit To\"},{\"transactionId\":1,\"accountId\":4,\"debit\":\"0.00\",\"credit\":\"4130000.00\",\"description\":\"Income Source\"}]}', 3, '2026-04-02 10:06:06'),
(42, 1, 'transaction', 2, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"ronak\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":2,\"contactId\":2,\"categoryId\":2,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"500000\",\"amountBase\":\"500000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"500000\",\"currencyId\":2},\"entries\":[{\"transactionId\":2,\"accountId\":2,\"debit\":\"500000.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":2,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"500000.00\",\"description\":\"Paid From\"}]}', 3, '2026-04-02 10:07:05'),
(43, 1, 'transaction', 3, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":4,\"contactId\":null,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"100000\",\"amountBase\":\"100000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000\",\"currencyId\":2},\"entries\":[{\"transactionId\":3,\"accountId\":1,\"debit\":\"100000.00\",\"credit\":\"0.00\",\"description\":\"Transfer In\"},{\"transactionId\":3,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"100000.00\",\"description\":\"Transfer Out\"}]}', 3, '2026-04-02 10:07:26'),
(44, 1, 'transaction', 4, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"ronak\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":2,\"contactId\":2,\"categoryId\":6,\"subCategoryId\":2,\"notes\":\"\",\"amountLocal\":\"5000\",\"amountBase\":\"5000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"5000\",\"currencyId\":2},\"entries\":[{\"transactionId\":4,\"accountId\":6,\"debit\":\"5000.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":4,\"accountId\":1,\"debit\":\"0.00\",\"credit\":\"5000.00\",\"description\":\"Paid From\"}]}', 3, '2026-04-02 10:07:54'),
(45, 1, 'account', 3, 'create', NULL, '{\"id\":3,\"orgId\":1,\"name\":\"Groww\",\"accountType\":1,\"subtype\":14,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-02\",\"accountNumber\":null,\"currencyId\":2,\"ifsc\":null,\"zipCode\":null,\"bankBranchName\":null,\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-02 10:08:59'),
(46, 1, 'category', 7, 'create', NULL, '{\"name\":\"Mutual Fund\",\"txnType\":\"expense\",\"orgId\":1}', 3, '2026-04-02 10:09:22'),
(47, 1, 'category', 7, 'update', '{\"id\":7,\"orgId\":1,\"txnTypeId\":2,\"name\":\"Mutual Fund\",\"status\":1,\"createdAt\":\"2026-04-02T10:09:22.000Z\"}', '{\"id\":7,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fund\",\"status\":1,\"createdAt\":\"2026-04-02T10:09:22.000Z\"}', 3, '2026-04-02 10:09:41'),
(48, 1, 'subcategory', 4, 'create', NULL, '{\"id\":4,\"categoryId\":7,\"name\":\"Axis midcap\",\"categoryName\":\"Mutual Fund\"}', 3, '2026-04-02 10:09:52'),
(49, 1, 'transaction', 5, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":4,\"contactId\":null,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"600000\",\"amountBase\":\"600000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"600000\",\"currencyId\":2},\"entries\":[{\"transactionId\":5,\"accountId\":3,\"debit\":\"600000.00\",\"credit\":\"0.00\",\"description\":\"Transfer In\"},{\"transactionId\":5,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"600000.00\",\"description\":\"Transfer Out\"}]}', 3, '2026-04-02 10:10:21'),
(50, 1, 'account', 4, 'create', NULL, '{\"id\":4,\"orgId\":1,\"name\":\"Wio\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"2323.00\",\"openingBalanceDate\":\"2026-04-02\",\"accountNumber\":\"56456465\",\"currencyId\":null,\"ifsc\":\"HDFC0000000\",\"zipCode\":\"HHHHHHHH\",\"bankBranchName\":\"dfgghfg\",\"description\":null,\"status\":1,\"createdBy\":5,\"createdAt\":null,\"updatedAt\":null}', 5, '2026-04-02 10:25:25'),
(51, 1, 'transaction', 5, 'update', '{\"id\":5,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"600000.00\",\"amountBase\":\"600000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"600000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:10:21.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":4,\"name\":\"Transfer\"},\"currency\":{\"id\":2,\"code\":\"INR\",\"name\":\"Indian Rupee\",\"symbol\":\"₹\",\"status\":1,\"createdAt\":\"2026-02-18T11:06:34.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":2,\"updatedAt\":\"2026-04-02T10:36:19.427Z\",\"createdBy\":5,\"fxRate\":\"1\",\"amountLocal\":\"600000.00\",\"name\":\"ronak\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":3,\"categoryId\":7,\"subCategoryId\":4,\"notes\":\"\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"600000\",\"contactId\":2,\"currencyId\":2}', 5, '2026-04-02 10:36:19'),
(52, 1, 'subcategory', 5, 'create', NULL, '{\"id\":5,\"categoryId\":7,\"name\":\"qwer\",\"categoryName\":\"Mutual Fund\"}', 5, '2026-04-02 10:37:48'),
(53, 1, 'category', 8, 'create', NULL, '{\"name\":\"Stockds\",\"txnType\":\"investment\",\"orgId\":1}', 5, '2026-04-02 10:39:24'),
(54, 1, 'subcategory', 6, 'create', NULL, '{\"id\":6,\"categoryId\":8,\"name\":\"axs\",\"categoryName\":\"Stockds\"}', 5, '2026-04-02 10:39:33'),
(55, 1, 'transaction', 5, 'delete', '{\"id\":5,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"ronak\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":3,\"categoryId\":7,\"subCategoryId\":4,\"contactId\":2,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"600000.00\",\"amountBase\":\"600000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"600000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T10:10:21.000Z\",\"updatedAt\":\"2026-04-02T10:36:19.000Z\"}', NULL, 5, '2026-04-02 10:39:42'),
(56, 1, 'transaction', 6, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":4,\"contactId\":null,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"10000\",\"amountBase\":\"10000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"10000\",\"currencyId\":2},\"entries\":[{\"transactionId\":6,\"accountId\":3,\"debit\":\"10000.00\",\"credit\":\"0.00\",\"description\":\"Transfer In\"},{\"transactionId\":6,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"10000.00\",\"description\":\"Transfer Out\"}]}', 5, '2026-04-02 10:41:46'),
(57, 1, 'transaction', 1, 'delete', '{\"id\":1,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"Google Asia\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":1,\"categoryId\":4,\"subCategoryId\":null,\"contactId\":1,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"3500000.00\",\"amountBase\":\"3500000.00\",\"isTaxable\":true,\"gstType\":1,\"gstRate\":\"18.00\",\"cgstAmount\":\"315000.00\",\"sgstAmount\":\"315000.00\",\"igstAmount\":\"0.00\",\"gstTotal\":\"630000.00\",\"finalAmount\":\"4130000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:06:05.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 11:22:23'),
(58, 1, 'transaction', 2, 'delete', '{\"id\":2,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"ronak\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":2,\"categoryId\":2,\"subCategoryId\":null,\"contactId\":2,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"500000.00\",\"amountBase\":\"500000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"500000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:07:05.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 11:22:26'),
(59, 1, 'transaction', 3, 'delete', '{\"id\":3,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"100000.00\",\"amountBase\":\"100000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:07:26.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 11:22:31'),
(60, 1, 'transaction', 4, 'delete', '{\"id\":4,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"ronak\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":2,\"categoryId\":6,\"subCategoryId\":2,\"contactId\":2,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"5000.00\",\"amountBase\":\"5000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"5000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:07:54.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 11:22:34'),
(61, 1, 'transaction', 6, 'delete', '{\"id\":6,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"10000.00\",\"amountBase\":\"10000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"10000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T10:41:46.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 11:22:38'),
(62, 1, 'account', 4, 'delete', '{\"id\":4,\"orgId\":1,\"name\":\"Wio\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"2323.00\",\"openingBalanceDate\":\"2026-04-02\",\"accountNumber\":\"56456465\",\"currencyId\":null,\"ifsc\":\"HDFC0000000\",\"zipCode\":\"HHHHHHHH\",\"bankBranchName\":\"dfgghfg\",\"description\":null,\"status\":1,\"createdBy\":5,\"createdAt\":null,\"updatedAt\":null}', NULL, 5, '2026-04-02 11:25:19'),
(63, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"9492949.03\",\"openingBalanceDate\":\"2026-03-31\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 5, '2026-04-02 11:26:45'),
(64, 1, 'account', 5, 'create', NULL, '{\"id\":5,\"orgId\":1,\"name\":\"JKsol ICICI-215\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"705196.90\",\"openingBalanceDate\":\"2026-03-01\",\"accountNumber\":\"183705501215\",\"currencyId\":2,\"ifsc\":\"ICIC0001837\",\"zipCode\":\"ICICINBBNRI\",\"bankBranchName\":\"L.P Savani Road\",\"description\":null,\"status\":1,\"createdBy\":5,\"createdAt\":null,\"updatedAt\":null}', 5, '2026-04-02 11:32:04'),
(65, 1, 'category', 1, 'delete', '{\"id\":1,\"orgId\":1,\"txnTypeId\":2,\"name\":\"Office Cleaning\",\"status\":1,\"createdAt\":\"2026-04-02T09:57:30.000Z\"}', NULL, 5, '2026-04-02 11:32:33'),
(66, 1, 'category', 2, 'delete', '{\"id\":2,\"orgId\":1,\"txnTypeId\":2,\"name\":\"Stationary\",\"status\":1,\"createdAt\":\"2026-04-02T09:57:58.000Z\"}', NULL, 5, '2026-04-02 11:32:38'),
(67, 1, 'category', 4, 'delete', '{\"id\":4,\"orgId\":1,\"txnTypeId\":1,\"name\":\"Google Admob\",\"status\":1,\"createdAt\":\"2026-04-02T09:58:18.000Z\"}', NULL, 5, '2026-04-02 11:32:42'),
(68, 1, 'category', 5, 'delete', '{\"id\":5,\"orgId\":1,\"txnTypeId\":1,\"name\":\"Apple Inapp\",\"status\":1,\"createdAt\":\"2026-04-02T09:58:29.000Z\"}', NULL, 5, '2026-04-02 11:32:47'),
(69, 1, 'category', 6, 'delete', '{\"id\":6,\"orgId\":1,\"txnTypeId\":2,\"name\":\"Employee Salary\",\"status\":1,\"createdAt\":\"2026-04-02T09:59:15.000Z\"}', NULL, 5, '2026-04-02 11:32:52'),
(70, 1, 'category', 7, 'delete', '{\"id\":7,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fund\",\"status\":1,\"createdAt\":\"2026-04-02T10:09:22.000Z\"}', NULL, 5, '2026-04-02 11:32:56'),
(71, 1, 'category', 8, 'delete', '{\"id\":8,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Stockds\",\"status\":1,\"createdAt\":\"2026-04-02T10:39:24.000Z\"}', NULL, 5, '2026-04-02 11:33:01'),
(72, 1, 'category', 9, 'create', NULL, '{\"name\":\"NJ India\",\"txnType\":\"investment\",\"orgId\":1}', 5, '2026-04-02 11:33:42'),
(73, 1, 'account', 3, 'update', '{\"id\":3,\"orgId\":1,\"name\":\"Groww\",\"accountType\":1,\"subtype\":14,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-02\",\"accountNumber\":null,\"currencyId\":2,\"ifsc\":null,\"zipCode\":null,\"bankBranchName\":null,\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":3,\"orgId\":1,\"name\":\"NJ India\",\"accountType\":1,\"subtype\":14,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-02\",\"accountNumber\":null,\"currencyId\":2,\"ifsc\":null,\"zipCode\":null,\"bankBranchName\":null,\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 5, '2026-04-02 11:35:05'),
(74, 1, 'transaction', 7, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"contactId\":null,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"amountLocal\":\"100000\",\"amountBase\":\"100000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000\",\"currencyId\":2},\"entries\":[{\"transactionId\":7,\"accountId\":2,\"debit\":\"100000.00\",\"credit\":\"0.00\",\"description\":\"Transfer In\"},{\"transactionId\":7,\"accountId\":5,\"debit\":\"0.00\",\"credit\":\"100000.00\",\"description\":\"Transfer Out\"}]}', 5, '2026-04-02 11:39:02'),
(75, 1, 'transaction', 7, 'update', '{\"id\":7,\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"100000.00\",\"amountBase\":\"100000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T11:39:02.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":4,\"name\":\"Transfer\"},\"currency\":{\"id\":2,\"code\":\"INR\",\"name\":\"Indian Rupee\",\"symbol\":\"₹\",\"status\":1,\"createdAt\":\"2026-02-18T11:06:34.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":1,\"updatedAt\":\"2026-04-02T11:41:59.102Z\",\"createdBy\":5,\"fxRate\":\"1\",\"amountLocal\":\"100000.00\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000\",\"contactId\":null,\"currencyId\":2}', 5, '2026-04-02 11:41:59'),
(76, 1, 'transaction', 7, 'update', '{\"id\":7,\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"100000.00\",\"amountBase\":\"100000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T11:39:02.000Z\",\"updatedAt\":\"2026-04-02T11:41:59.000Z\",\"transactionType\":{\"id\":4,\"name\":\"Transfer\"},\"currency\":{\"id\":2,\"code\":\"INR\",\"name\":\"Indian Rupee\",\"symbol\":\"₹\",\"status\":1,\"createdAt\":\"2026-02-18T11:06:34.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":1,\"updatedAt\":\"2026-04-02T11:43:47.464Z\",\"createdBy\":5,\"fxRate\":\"1\",\"amountLocal\":\"100000.00\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000\",\"contactId\":null,\"currencyId\":2}', 5, '2026-04-02 11:43:47'),
(77, 1, 'party', 1, 'delete', '{\"id\":1,\"orgId\":1,\"companyName\":\"Google Asia\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:04:26.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 11:44:36'),
(78, 1, 'party', 2, 'delete', '{\"id\":2,\"orgId\":1,\"companyName\":\"ronak\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"24AXMPV5554H1ZY\",\"gstName\":\"ronak\",\"status\":1,\"createdBy\":3,\"createdAt\":\"2026-04-02T10:04:56.000Z\",\"updatedAt\":null}', NULL, 5, '2026-04-02 11:44:41'),
(79, 1, 'party', 3, 'create', NULL, '{\"id\":3,\"orgId\":1,\"companyName\":\"Google India Pvt. LTD (Gsuite)\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"Tower B, Unitech Signature Tower II,Sector 15, Part I, Village Silokhera,Gurugram, Haryana 122002,India\",\"gstNo\":\"06AACCG0527D1Z8\",\"gstName\":\"Google India Pvt. LTD (Gsuite)\",\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T11:46:36.000Z\",\"updatedAt\":null}', 5, '2026-04-02 11:46:36'),
(80, 1, 'category', 10, 'create', NULL, '{\"name\":\"Domain Charges (Gsuite)\",\"txnType\":\"expense\",\"orgId\":1}', 5, '2026-04-02 11:47:11'),
(81, 1, 'transaction', 8, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"Google India Pvt. LTD (Gsuite)\",\"txnDate\":\"2026-03-03\",\"txnTypeId\":2,\"contactId\":3,\"categoryId\":10,\"subCategoryId\":null,\"notes\":\"ME DC SI 403875XXXXXX7554 GOOGLE WORKSPACE CYBS\\r\\nFeb.-2026 Invoice Payment\",\"amountLocal\":\"1534\",\"amountBase\":\"1534\",\"fxRate\":\"1\",\"attachmentPath\":\"/uploads/transactions/6bec0878-4c84-408b-a044-61e8abb7baab-03_Google Gsuite ID-0237 ( Rs. 1534).pdf\",\"status\":\"1\",\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"1534\",\"currencyId\":2},\"entries\":[{\"transactionId\":8,\"accountId\":10,\"debit\":\"1534.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":8,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"1534.00\",\"description\":\"Paid From\"}]}', 5, '2026-04-02 11:49:05'),
(82, 1, 'transaction', 9, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"Google India Pvt. LTD (Gsuite)\",\"txnDate\":\"2026-03-03\",\"txnTypeId\":2,\"contactId\":3,\"categoryId\":10,\"subCategoryId\":null,\"notes\":\"ME DC SI 403875XXXXXX7554 GOOGLE WORKSPACE CYBS\\r\\nFeb.-2026 invoice payment\",\"amountLocal\":\"1534\",\"amountBase\":\"1534\",\"fxRate\":\"1\",\"attachmentPath\":\"/uploads/transactions/5e305a35-9a0d-452e-a267-180b77552f95-06_Google Gsuite ID-2394 (Rs. 1534).pdf\",\"status\":\"1\",\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"1534\",\"currencyId\":2},\"entries\":[{\"transactionId\":9,\"accountId\":10,\"debit\":\"1534.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":9,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"1534.00\",\"description\":\"Paid From\"}]}', 5, '2026-04-02 11:51:26'),
(83, 1, 'party', 4, 'create', NULL, '{\"id\":4,\"orgId\":1,\"companyName\":\"Google Asia Pvt LTD\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"70 Pasir Panjang Road, #03-71,Mapletree Business City,,Singapore 117371\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T11:55:13.000Z\",\"updatedAt\":null}', 5, '2026-04-02 11:55:13'),
(84, 1, 'category', 11, 'create', NULL, '{\"name\":\"Internet Advertising Revenue\",\"txnType\":\"income\",\"orgId\":1}', 5, '2026-04-02 11:56:13'),
(85, 1, 'transaction', 10, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"Google Asia Pvt LTD\",\"txnDate\":\"2026-03-24\",\"txnTypeId\":1,\"contactId\":4,\"categoryId\":11,\"subCategoryId\":null,\"notes\":\"INW 240326I049903166 USD181378.16@93.819\\r\\nFeb.-2026 month, admob:-jksol infotech\",\"amountLocal\":\"17016717.59\",\"amountBase\":\"17016717.59\",\"fxRate\":\"1\",\"attachmentPath\":\"/uploads/transactions/f228433c-c84c-4d0b-83a6-90be45c84d14-116_HDFC Bank (Rs. 1,70,16,717.59).pdf\",\"status\":\"1\",\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"17016717.59\",\"currencyId\":2},\"entries\":[{\"transactionId\":10,\"accountId\":2,\"debit\":\"17016717.59\",\"credit\":\"0.00\",\"description\":\"Deposit To\"},{\"transactionId\":10,\"accountId\":11,\"debit\":\"0.00\",\"credit\":\"17016717.59\",\"description\":\"Income Source\"}]}', 5, '2026-04-02 11:59:00'),
(86, 1, 'transaction', 7, 'update', '{\"id\":7,\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"100000.00\",\"amountBase\":\"100000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T11:39:02.000Z\",\"updatedAt\":\"2026-04-02T11:43:47.000Z\",\"transactionType\":{\"id\":4,\"name\":\"Transfer\"},\"currency\":{\"id\":2,\"code\":\"INR\",\"name\":\"Indian Rupee\",\"symbol\":\"₹\",\"status\":1,\"createdAt\":\"2026-02-18T11:06:34.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":1,\"updatedAt\":\"2026-04-02T12:02:39.088Z\",\"createdBy\":5,\"fxRate\":\"1\",\"amountLocal\":\"100000.00\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000\",\"contactId\":null,\"currencyId\":2}', 5, '2026-04-02 12:02:39'),
(87, 1, 'transaction', 7, 'update', '{\"id\":7,\"orgId\":1,\"branchId\":2,\"financialYearId\":1,\"name\":\"\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"100000.00\",\"amountBase\":\"100000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-02T11:39:02.000Z\",\"updatedAt\":\"2026-04-02T12:02:39.000Z\",\"transactionType\":{\"id\":4,\"name\":\"Transfer\"},\"currency\":{\"id\":2,\"code\":\"INR\",\"name\":\"Indian Rupee\",\"symbol\":\"₹\",\"status\":1,\"createdAt\":\"2026-02-18T11:06:34.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":1,\"updatedAt\":\"2026-04-02T12:07:21.096Z\",\"createdBy\":5,\"fxRate\":\"1\",\"amountLocal\":\"100000.00\",\"txnDate\":\"2026-03-02\",\"txnTypeId\":4,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\\n\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100000\",\"contactId\":null,\"currencyId\":2}', 5, '2026-04-02 12:07:21'),
(88, 1, 'category', 12, 'create', NULL, '{\"name\":\"Bank Charge\",\"txnType\":\"expense\",\"orgId\":1}', 5, '2026-04-02 12:13:01'),
(89, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-03 03:24:52'),
(90, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-03 03:49:32'),
(91, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-03 04:00:40'),
(92, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-03 05:40:58'),
(93, 1, 'party', 5, 'create', NULL, '{\"id\":5,\"orgId\":1,\"companyName\":\"Cell Rebel AB\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-03T10:16:28.000Z\",\"updatedAt\":null}', 5, '2026-04-03 10:16:28'),
(94, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-04-03 11:06:47'),
(95, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"\",\"bankName\":\"\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-03 11:15:10'),
(96, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"\",\"bankName\":\"\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-03 11:15:10'),
(97, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-03 11:15:10'),
(98, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-03 11:15:10'),
(99, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-04 03:32:47'),
(100, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-06 03:13:46'),
(101, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-06 03:21:58'),
(102, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-04-06 03:23:09'),
(103, 1, 'account', 6, 'create', NULL, '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":null,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-06 03:26:54'),
(104, 1, 'transaction', 11, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Google India Pvt. LTD (Gsuite)\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"contactId\":3,\"categoryId\":10,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"52200\",\"amountBase\":\"52200\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"52200\"},\"entries\":[{\"transactionId\":11,\"accountId\":10,\"debit\":\"52200.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":11,\"accountId\":6,\"debit\":\"0.00\",\"credit\":\"52200.00\",\"description\":\"Paid From\"}]}', 3, '2026-04-06 04:00:08'),
(105, 1, 'transaction', 12, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":1,\"contactId\":5,\"categoryId\":11,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"900000\",\"amountBase\":\"900000\",\"fxRate\":\"1\",\"attachmentPath\":\"/uploads/transactions/23d39264-d50d-4d73-b48a-614f7d521ec0-INV-000884.pdf\",\"status\":\"1\",\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"900000\"},\"entries\":[{\"transactionId\":12,\"accountId\":6,\"debit\":\"900000.00\",\"credit\":\"0.00\",\"description\":\"Deposit To\"},{\"transactionId\":12,\"accountId\":11,\"debit\":\"0.00\",\"credit\":\"900000.00\",\"description\":\"Income Source\"}]}', 3, '2026-04-06 04:00:45'),
(106, 1, 'category', 13, 'create', NULL, '{\"name\":\"salary\",\"txnType\":\"expense\",\"orgId\":1}', 5, '2026-04-06 06:35:13');
INSERT INTO `audit_logs` (`id`, `org_id`, `entity`, `entity_id`, `action`, `old_value_json`, `new_value_json`, `action_by`, `action_at`) VALUES
(107, 1, 'transaction', 13, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Google Asia Pvt LTD\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"contactId\":4,\"categoryId\":13,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"100\",\"amountBase\":\"100\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100\"},\"entries\":[{\"transactionId\":13,\"accountId\":13,\"debit\":\"100.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":13,\"accountId\":6,\"debit\":\"0.00\",\"credit\":\"100.00\",\"description\":\"Paid From\"}]}', 3, '2026-04-06 10:08:23'),
(108, 1, 'subcategory', 7, 'create', NULL, '{\"id\":7,\"categoryId\":10,\"name\":\"Google Workspace\",\"categoryName\":\"Domain Charges (Gsuite)\"}', 5, '2026-04-06 11:10:05'),
(109, 1, 'subcategory', 7, 'update', '{\"id\":7,\"categoryId\":10,\"name\":\"Google Workspace\",\"status\":1,\"createdAt\":\"2026-04-06T11:10:05.000Z\",\"categoryName\":\"Domain Charges (Gsuite)\"}', '{\"id\":7,\"categoryId\":10,\"name\":\"Google Workspace\",\"status\":2,\"createdAt\":\"2026-04-06T11:10:05.000Z\",\"categoryName\":\"Domain Charges (Gsuite)\"}', 5, '2026-04-06 11:10:26'),
(110, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-07 05:01:20'),
(111, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-04-07 06:51:28'),
(112, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-07 10:15:52'),
(113, 1, 'transaction', 14, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"Google India Pvt. LTD (Gsuite)\",\"txnDate\":\"2026-04-07\",\"txnTypeId\":2,\"contactId\":3,\"categoryId\":10,\"subCategoryId\":7,\"notes\":\"\",\"amountLocal\":\"5000\",\"amountBase\":\"5000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"5000\",\"currencyId\":2},\"entries\":[{\"transactionId\":14,\"accountId\":10,\"debit\":\"5000.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":14,\"accountId\":5,\"debit\":\"0.00\",\"credit\":\"5000.00\",\"description\":\"Paid From\"}]}', 5, '2026-04-07 12:11:06'),
(114, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-04-08 09:19:03'),
(115, 1, 'subcategory', 8, 'create', NULL, '{\"id\":8,\"categoryId\":9,\"name\":\"mf\",\"categoryName\":\"NJ India\"}', 3, '2026-04-08 10:11:34'),
(116, 1, 'account', 6, 'update', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":null,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":null,\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":1,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-08 10:42:35'),
(117, 1, 'account', 6, 'update', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":1,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":1,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-08 10:42:35'),
(118, 1, 'account', 6, 'update', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":1,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":1,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-08 10:42:35'),
(119, 1, 'account', 6, 'update', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":1,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":6,\"orgId\":1,\"name\":\"Wio Bank\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"0.00\",\"openingBalanceDate\":\"2026-04-06\",\"accountHolderName\":\"NEON INFOTECH FZ-LLC\",\"bankName\":\"wio\",\"accountNumber\":\"87878787878\",\"currencyId\":1,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANACHOKDIBRANCH\",\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 3, '2026-04-08 10:42:36'),
(120, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-08 11:30:59'),
(121, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-10 04:45:02'),
(122, 1, 'category', 9, 'delete', '{\"id\":9,\"orgId\":1,\"txnTypeId\":3,\"name\":\"NJ India\",\"status\":1,\"createdAt\":\"2026-04-02T11:33:42.000Z\"}', NULL, 5, '2026-04-10 05:01:06'),
(123, 1, 'party', 6, 'create', NULL, '{\"id\":6,\"orgId\":1,\"companyName\":\"NJ India\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-10T05:01:28.000Z\",\"updatedAt\":null}', 5, '2026-04-10 05:01:28'),
(124, 1, 'category', 15, 'create', NULL, '{\"name\":\"Mutual Fand\",\"txnType\":\"investment\",\"orgId\":1}', 5, '2026-04-10 05:04:00'),
(125, 1, 'subcategory', 9, 'create', NULL, '{\"id\":9,\"categoryId\":15,\"name\":\"Axia Mid Cap 50\",\"categoryName\":\"Mutual Fand\"}', 5, '2026-04-10 05:04:23'),
(126, 1, 'category', 15, 'update', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', 5, '2026-04-10 05:08:25'),
(127, 1, 'category', 15, 'update', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', 5, '2026-04-10 05:08:25'),
(128, 1, 'category', 15, 'update', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', 5, '2026-04-10 05:08:25'),
(129, 1, 'category', 15, 'update', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', 5, '2026-04-10 05:08:25'),
(130, 1, 'category', 15, 'update', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', '{\"id\":15,\"orgId\":1,\"txnTypeId\":3,\"name\":\"Mutual Fand- NJ India\",\"status\":1,\"createdAt\":\"2026-04-10T05:04:00.000Z\"}', 5, '2026-04-10 05:08:25'),
(131, 1, 'transaction', 15, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"NJ India\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":3,\"contactId\":6,\"categoryId\":15,\"subCategoryId\":9,\"notes\":\"\",\"amountLocal\":\"500000\",\"amountBase\":\"500000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"500000\",\"currencyId\":2},\"entries\":[{\"transactionId\":15,\"accountId\":3,\"debit\":\"500000.00\",\"credit\":\"0.00\",\"description\":\"Investment\"},{\"transactionId\":15,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"500000.00\",\"description\":\"Paid From\"}]}', 5, '2026-04-10 05:09:42'),
(132, 1, 'transaction', 15, 'update', '{\"id\":15,\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"NJ India\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":3,\"categoryId\":15,\"subCategoryId\":9,\"contactId\":6,\"notes\":\"\",\"currencyId\":2,\"fxRate\":\"1.00000000\",\"amountLocal\":\"500000.00\",\"amountBase\":\"500000.00\",\"isTaxable\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"500000.00\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-10T05:09:42.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":3,\"name\":\"Investment\"},\"currency\":{\"id\":2,\"code\":\"INR\",\"name\":\"Indian Rupee\",\"symbol\":\"₹\",\"status\":1,\"createdAt\":\"2026-02-18T11:06:34.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":2,\"updatedAt\":\"2026-04-10T05:10:55.136Z\",\"createdBy\":5,\"fxRate\":\"1\",\"amountLocal\":\"500000.00\",\"name\":\"NJ India\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":3,\"categoryId\":15,\"subCategoryId\":9,\"notes\":\"\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"500000\",\"contactId\":6,\"currencyId\":2}', 5, '2026-04-10 05:10:55'),
(133, 1, 'transaction', 16, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":4,\"contactId\":null,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"1500000\",\"amountBase\":\"1500000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"1500000\",\"currencyId\":2},\"entries\":[{\"transactionId\":16,\"accountId\":2,\"debit\":\"1500000.00\",\"credit\":\"0.00\",\"description\":\"Transfer In\"},{\"transactionId\":16,\"accountId\":5,\"debit\":\"0.00\",\"credit\":\"1500000.00\",\"description\":\"Transfer Out\"}]}', 5, '2026-04-10 05:21:51'),
(134, 1, 'transaction', 17, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":4,\"contactId\":null,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"5000000\",\"amountBase\":\"5000000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"5000000\",\"currencyId\":2},\"entries\":[{\"transactionId\":17,\"accountId\":5,\"debit\":\"5000000.00\",\"credit\":\"0.00\",\"description\":\"Transfer In\"},{\"transactionId\":17,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"5000000.00\",\"description\":\"Transfer Out\"}]}', 5, '2026-04-10 05:40:23'),
(135, 1, 'transaction', 18, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":2,\"financialYearId\":2,\"name\":\"\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":4,\"contactId\":null,\"categoryId\":null,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"200000\",\"amountBase\":\"200000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"200000\",\"currencyId\":2},\"entries\":[{\"transactionId\":18,\"accountId\":1,\"debit\":\"200000.00\",\"credit\":\"0.00\",\"description\":\"Transfer In\"},{\"transactionId\":18,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"200000.00\",\"description\":\"Transfer Out\"}]}', 5, '2026-04-10 05:41:07'),
(136, 1, 'category', 16, 'create', NULL, '{\"name\":\"Employee Welfair Exp.\",\"txnType\":\"expense\",\"orgId\":1}', 5, '2026-04-10 05:41:57'),
(137, 1, 'transaction', 19, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":2,\"contactId\":5,\"categoryId\":12,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"210\",\"amountBase\":\"210\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"210\"},\"entries\":[{\"transactionId\":19,\"accountId\":12,\"debit\":\"210.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":19,\"accountId\":6,\"debit\":\"0.00\",\"credit\":\"210.00\",\"description\":\"Paid From\"}]}', 5, '2026-04-10 05:44:15'),
(138, 1, 'transaction', 20, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":1,\"contactId\":5,\"categoryId\":11,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"2000\",\"amountBase\":\"7345\",\"fxRate\":\"3.6725\",\"attachmentPath\":null,\"status\":1,\"createdBy\":5,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"7345\",\"currencyId\":1},\"entries\":[{\"transactionId\":20,\"accountId\":6,\"debit\":\"2000.00\",\"credit\":\"0.00\",\"description\":\"Deposit To\"},{\"transactionId\":20,\"accountId\":11,\"debit\":\"0.00\",\"credit\":\"2000.00\",\"description\":\"Income Source\"}]}', 5, '2026-04-10 05:48:38'),
(139, 1, 'subcategory', 7, 'update', '{\"id\":7,\"categoryId\":10,\"name\":\"Google Workspace\",\"status\":2,\"createdAt\":\"2026-04-06T11:10:05.000Z\",\"categoryName\":\"Domain Charges (Gsuite)\"}', '{\"id\":7,\"categoryId\":10,\"name\":\"Google Workspace\",\"status\":1,\"createdAt\":\"2026-04-06T11:10:05.000Z\",\"categoryName\":\"Domain Charges (Gsuite)\"}', 5, '2026-04-10 07:10:30'),
(140, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-10 10:52:49'),
(141, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-04-10 13:07:14'),
(142, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-13 03:56:31'),
(143, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-14 06:21:43'),
(144, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-15 09:59:04'),
(145, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-22 04:17:37'),
(146, 1, 'user', 5, 'LOGIN', NULL, NULL, 5, '2026-04-22 07:08:32'),
(147, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-24 09:54:24'),
(148, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-04-27 10:51:00'),
(149, 1, 'user', 35, 'ADD_MEMBER', NULL, '{\"email\":\"jksol.yesha@gmail.com\",\"role\":\"owner\",\"branches\":null}', 1, '2026-04-27 11:17:43'),
(150, 1, 'user', 35, 'LOGIN', NULL, NULL, 35, '2026-04-28 04:12:21'),
(151, 1, 'user', 37, 'ADD_MEMBER', NULL, '{\"email\":\"kalpesh@jksol.com\",\"role\":\"owner\",\"branches\":null}', 1, '2026-04-28 06:09:43'),
(152, 1, 'user', 37, 'LOGIN', NULL, NULL, 37, '2026-04-28 06:16:00'),
(153, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-05-04 04:42:02'),
(154, 1, 'user', 3, 'LOGIN', NULL, NULL, 3, '2026-05-23 06:19:18'),
(155, 1, 'transaction', 21, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"NJ India\",\"txnDate\":\"2026-05-23\",\"txnTypeId\":3,\"contactId\":6,\"categoryId\":15,\"subCategoryId\":9,\"notes\":\"\",\"amountLocal\":2523,\"amountBase\":\"9265.72\",\"fxRate\":\"3.6725\",\"attachmentPath\":null,\"status\":1,\"createdBy\":3,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"9265.72\",\"currencyId\":1},\"entries\":[{\"transactionId\":21,\"accountId\":3,\"debit\":\"2523.00\",\"credit\":\"0.00\",\"description\":\"Investment\"},{\"transactionId\":21,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"2523.00\",\"description\":\"Paid From\"}]}', 3, '2026-05-23 06:23:01'),
(156, 1, 'user', 1, 'LOGIN', NULL, NULL, 1, '2026-05-25 10:16:17'),
(157, 1, 'user', 35, 'LOGIN', NULL, NULL, 35, '2026-05-25 11:34:08'),
(158, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":2,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"branchId\":null,\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":7,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"branchId\":3,\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 35, '2026-05-26 03:58:48'),
(159, 1, 'transaction', 22, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-01\",\"txnTypeId\":1,\"contactId\":6,\"categoryId\":15,\"subCategoryId\":null,\"notes\":\"NEFT \",\"amountLocal\":\"1000\",\"amountBase\":\"1000\",\"fxRate\":\"1\",\"attachmentPath\":\"/uploads/transactions/b7a38bf2-f656-45c7-8663-4430964d8870-Branch Module.pdf\",\"status\":1,\"createdBy\":35,\"importedStatementId\":1,\"bankTransactionKey\":null,\"isTaxable\":1,\"gstType\":1,\"gstRate\":\"18\",\"cgstAmount\":\"90\",\"sgstAmount\":\"90\",\"igstAmount\":\"0\",\"gstTotal\":\"180\",\"finalAmount\":\"1180\",\"currencyId\":7},\"entries\":[{\"transactionId\":22,\"accountId\":3,\"debit\":\"1180.00\",\"credit\":\"0.00\",\"description\":\"Deposit To\"},{\"transactionId\":22,\"accountId\":15,\"debit\":\"0.00\",\"credit\":\"1180.00\",\"description\":\"Income Source\"}]}', 35, '2026-05-26 03:58:57'),
(160, 1, 'transaction', 13, 'update', '{\"id\":13,\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Google Asia Pvt LTD\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"categoryId\":13,\"subCategoryId\":null,\"contactId\":4,\"notes\":\"\",\"currencyId\":null,\"fxRate\":\"1.00000000\",\"amountLocal\":\"100.00\",\"amountBase\":\"100.00\",\"isTaxable\":false,\"isRcm\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":null,\"bankTransactionKey\":null,\"createdBy\":3,\"createdAt\":\"2026-04-06T10:08:23.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":2,\"name\":\"Expense\"},\"currency\":null}', '{\"financialYearId\":2,\"updatedAt\":\"2026-05-26T04:05:43.400Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":10,\"name\":\"Google Asia Pvt LTD\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"categoryId\":13,\"subCategoryId\":null,\"notes\":\"\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"10\",\"contactId\":4,\"currencyId\":7}', 35, '2026-05-26 04:05:43'),
(161, 1, 'transaction', 13, 'update', '{\"id\":13,\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Google Asia Pvt LTD\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"categoryId\":13,\"subCategoryId\":null,\"contactId\":4,\"notes\":\"\",\"currencyId\":7,\"fxRate\":\"1.00000000\",\"amountLocal\":\"10.00\",\"amountBase\":\"100.00\",\"isTaxable\":false,\"isRcm\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"10.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":null,\"bankTransactionKey\":null,\"createdBy\":35,\"createdAt\":\"2026-04-06T10:08:23.000Z\",\"updatedAt\":\"2026-05-26T04:05:43.000Z\",\"transactionType\":{\"id\":2,\"name\":\"Expense\"},\"currency\":{\"id\":7,\"code\":\"AED\",\"name\":\"United Arab Emirates Dirham\",\"symbol\":\"AED\",\"status\":1,\"createdAt\":\"2026-04-27T11:16:01.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":2,\"updatedAt\":\"2026-05-26T04:05:53.832Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":100,\"name\":\"Google Asia Pvt LTD\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"categoryId\":13,\"subCategoryId\":null,\"notes\":\"\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100\",\"contactId\":4,\"currencyId\":7}', 35, '2026-05-26 04:05:53'),
(162, 1, 'transaction', 12, 'update', '{\"id\":12,\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":1,\"categoryId\":11,\"subCategoryId\":null,\"contactId\":5,\"notes\":\"\",\"currencyId\":null,\"fxRate\":\"1.00000000\",\"amountLocal\":\"900000.00\",\"amountBase\":\"900000.00\",\"isTaxable\":false,\"isRcm\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"900000.00\",\"attachmentPath\":\"/uploads/transactions/23d39264-d50d-4d73-b48a-614f7d521ec0-INV-000884.pdf\",\"status\":1,\"importedStatementId\":null,\"bankTransactionKey\":null,\"createdBy\":3,\"createdAt\":\"2026-04-06T04:00:45.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":1,\"name\":\"Income\"},\"currency\":null}', '{\"financialYearId\":2,\"updatedAt\":\"2026-05-26T04:06:43.063Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":\"90000\",\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":1,\"categoryId\":11,\"subCategoryId\":null,\"notes\":\"\",\"status\":\"1\",\"attachmentPath\":\"/uploads/transactions/23d39264-d50d-4d73-b48a-614f7d521ec0-INV-000884.pdf\",\"isTaxable\":0,\"finalAmount\":\"90000\",\"contactId\":5,\"currencyId\":7}', 35, '2026-05-26 04:06:43'),
(163, 1, 'transaction', 11, 'update', '{\"id\":11,\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Google India Pvt. LTD (Gsuite)\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"categoryId\":10,\"subCategoryId\":null,\"contactId\":3,\"notes\":\"\",\"currencyId\":null,\"fxRate\":\"1.00000000\",\"amountLocal\":\"52200.00\",\"amountBase\":\"52200.00\",\"isTaxable\":false,\"isRcm\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"52200.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":null,\"bankTransactionKey\":null,\"createdBy\":3,\"createdAt\":\"2026-04-06T04:00:08.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":2,\"name\":\"Expense\"},\"currency\":null}', '{\"financialYearId\":2,\"updatedAt\":\"2026-05-26T04:11:23.588Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":52200,\"name\":\"Google India Pvt. LTD (Gsuite)\",\"txnDate\":\"2026-04-06\",\"txnTypeId\":2,\"categoryId\":10,\"subCategoryId\":null,\"notes\":\"\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"52200\",\"contactId\":3,\"currencyId\":7}', 35, '2026-05-26 04:11:23'),
(164, 1, 'transaction', 20, 'update', '{\"id\":20,\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":1,\"categoryId\":11,\"subCategoryId\":null,\"contactId\":5,\"notes\":\"\",\"currencyId\":1,\"fxRate\":\"3.67250000\",\"amountLocal\":\"2000.00\",\"amountBase\":\"7345.00\",\"isTaxable\":false,\"isRcm\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"7345.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":null,\"bankTransactionKey\":null,\"createdBy\":5,\"createdAt\":\"2026-04-10T05:48:38.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":1,\"name\":\"Income\"},\"currency\":{\"id\":1,\"code\":\"USD\",\"name\":\"US Dollar\",\"symbol\":\"$\",\"status\":1,\"createdAt\":\"2026-02-18T11:06:34.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":2,\"updatedAt\":\"2026-05-26T04:12:10.316Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":210,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":2,\"categoryId\":12,\"subCategoryId\":null,\"notes\":\"\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"210\",\"contactId\":5,\"currencyId\":7}', 35, '2026-05-26 04:12:10'),
(165, 1, 'transaction', 20, 'update', '{\"id\":20,\"orgId\":1,\"branchId\":3,\"financialYearId\":2,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":2,\"categoryId\":12,\"subCategoryId\":null,\"contactId\":5,\"notes\":\"\",\"currencyId\":7,\"fxRate\":\"1.00000000\",\"amountLocal\":\"210.00\",\"amountBase\":\"7345.00\",\"isTaxable\":false,\"isRcm\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"210.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":null,\"bankTransactionKey\":null,\"createdBy\":35,\"createdAt\":\"2026-04-10T05:48:38.000Z\",\"updatedAt\":\"2026-05-26T04:12:10.000Z\",\"transactionType\":{\"id\":2,\"name\":\"Expense\"},\"currency\":{\"id\":7,\"code\":\"AED\",\"name\":\"United Arab Emirates Dirham\",\"symbol\":\"AED\",\"status\":1,\"createdAt\":\"2026-04-27T11:16:01.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":2,\"updatedAt\":\"2026-05-26T04:12:30.799Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":210,\"name\":\"Cell Rebel AB\",\"txnDate\":\"2026-04-10\",\"txnTypeId\":2,\"categoryId\":12,\"subCategoryId\":null,\"notes\":\"\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"210\",\"contactId\":5,\"currencyId\":7}', 35, '2026-05-26 04:12:30'),
(166, 1, 'party', 6, 'update', '{\"id\":6,\"orgId\":1,\"companyName\":\"NJ India\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-10T05:01:28.000Z\",\"updatedAt\":null}', '{\"id\":6,\"orgId\":1,\"companyName\":\"NJ India\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":2,\"createdBy\":5,\"createdAt\":\"2026-04-10T05:01:28.000Z\",\"updatedAt\":\"2026-05-26T04:45:36.000Z\"}', 35, '2026-05-26 04:45:36'),
(167, 1, 'party', 6, 'update', '{\"id\":6,\"orgId\":1,\"companyName\":\"NJ India\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":2,\"createdBy\":5,\"createdAt\":\"2026-04-10T05:01:28.000Z\",\"updatedAt\":\"2026-05-26T04:45:36.000Z\"}', '{\"id\":6,\"orgId\":1,\"companyName\":\"NJ India\",\"name\":\"\",\"email\":\"\",\"phone\":\"\",\"address\":\"\",\"gstNo\":\"\",\"gstName\":\"\",\"status\":1,\"createdBy\":5,\"createdAt\":\"2026-04-10T05:01:28.000Z\",\"updatedAt\":\"2026-05-26T04:45:38.000Z\"}', 35, '2026-05-26 04:45:38'),
(168, 1, 'transaction', 23, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-01\",\"txnTypeId\":2,\"contactId\":null,\"categoryId\":17,\"subCategoryId\":null,\"notes\":\"NEFT DR-ICIC0001837-KALPESH PRAVINBHAI P ADSHALA-NETBANK, MUM-HDFCH00707242240-CA PITAL\",\"amountLocal\":800000,\"amountBase\":\"800000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":35,\"importedStatementId\":2,\"bankTransactionKey\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"800000\",\"currencyId\":7},\"entries\":[{\"transactionId\":23,\"accountId\":17,\"debit\":\"800000.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":23,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"800000.00\",\"description\":\"Paid From\"}]}', 35, '2026-05-26 05:07:48'),
(169, 1, 'transaction', 23, 'update', '{\"id\":23,\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-01\",\"txnTypeId\":2,\"categoryId\":17,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"NEFT DR-ICIC0001837-KALPESH PRAVINBHAI P ADSHALA-NETBANK, MUM-HDFCH00707242240-CA PITAL\",\"currencyId\":7,\"fxRate\":\"1.00000000\",\"amountLocal\":\"800000.00\",\"amountBase\":\"800000.00\",\"isTaxable\":false,\"isRcm\":false,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"800000.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":2,\"bankTransactionKey\":null,\"createdBy\":35,\"createdAt\":\"2026-05-26T05:07:48.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":2,\"name\":\"Expense\"},\"currency\":{\"id\":7,\"code\":\"AED\",\"name\":\"United Arab Emirates Dirham\",\"symbol\":\"AED\",\"status\":1,\"createdAt\":\"2026-04-27T11:16:01.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":1,\"updatedAt\":\"2026-05-26T05:25:18.812Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":800000,\"name\":\"Transaction\",\"txnDate\":\"2026-01-01\",\"txnTypeId\":2,\"categoryId\":16,\"subCategoryId\":null,\"notes\":\"NEFT DR-ICIC0001837-KALPESH PRAVINBHAI P ADSHALA-NETBANK, MUM-HDFCH00707242240-CA PITAL\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"800000\",\"contactId\":null,\"currencyId\":7}', 35, '2026-05-26 05:25:18'),
(170, 1, 'user', 1, 'UPDATE_MEMBER_ACCESS', NULL, '{\"role\":\"owner\",\"branchIds\":null,\"name\":\"Saurav\",\"status\":2}', 35, '2026-05-26 05:26:58'),
(171, 1, 'user', 1, 'UPDATE_MEMBER_ACCESS', NULL, '{\"role\":\"owner\",\"branchIds\":null,\"name\":\"Saurav\",\"status\":1}', 35, '2026-05-26 05:27:00'),
(172, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":7,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"branchId\":3,\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-77\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":7,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"branchId\":3,\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 35, '2026-05-26 05:30:13'),
(173, 1, 'account', 2, 'update', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-77\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":7,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"branchId\":3,\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', '{\"id\":2,\"orgId\":1,\"name\":\"Jksol HDFC-777\",\"accountType\":1,\"subtype\":12,\"openingBalance\":\"85293518.48\",\"openingBalanceDate\":\"2026-03-01\",\"accountHolderName\":\"Jksol Infotech LLP\",\"bankName\":\"HDFC Bank\",\"accountNumber\":\"99999737372777\",\"currencyId\":7,\"ifsc\":\"HDFC0004693\",\"zipCode\":\"HDFCINBBXXX\",\"bankBranchName\":\"SARTHANA CHOKDI BRANCH\",\"branchId\":3,\"description\":\"\",\"status\":1,\"createdBy\":3,\"createdAt\":null,\"updatedAt\":null}', 35, '2026-05-26 05:30:19'),
(174, 1, 'user', 1, 'UPDATE_MEMBER_ACCESS', NULL, '{\"role\":\"owner\",\"branchIds\":null,\"name\":\"Saurav\",\"status\":1}', 35, '2026-05-26 05:33:40'),
(175, 1, 'user', 1, 'UPDATE_MEMBER_ACCESS', NULL, '{\"role\":\"owner\",\"branchIds\":null,\"name\":\"Saurav\",\"status\":1}', 35, '2026-05-26 05:33:47'),
(176, 1, 'organization', 1, 'UPDATE', '{\"id\":1,\"name\":\"JKSOL\",\"logo\":null,\"baseCurrency\":\"INR\",\"timezone\":\"Asia/Kolkata\",\"status\":1,\"createdAt\":\"2026-04-02T03:18:24.000Z\",\"updatedAt\":\"2026-04-02T03:18:24.000Z\"}', '{\"id\":1,\"name\":\"JKSOL\",\"logo\":null,\"baseCurrency\":\"USD\",\"timezone\":\"Asia/Kolkata\",\"status\":1,\"createdAt\":\"2026-04-02T03:18:24.000Z\",\"updatedAt\":\"2026-05-26T05:33:57.000Z\"}', 35, '2026-05-26 05:33:57'),
(177, 1, 'organization', 1, 'UPDATE', '{\"id\":1,\"name\":\"JKSOL\",\"logo\":null,\"baseCurrency\":\"USD\",\"timezone\":\"Asia/Kolkata\",\"status\":1,\"createdAt\":\"2026-04-02T03:18:24.000Z\",\"updatedAt\":\"2026-05-26T05:33:57.000Z\"}', '{\"id\":1,\"name\":\"JKSOL\",\"logo\":null,\"baseCurrency\":\"INR\",\"timezone\":\"Asia/Kolkata\",\"status\":1,\"createdAt\":\"2026-04-02T03:18:24.000Z\",\"updatedAt\":\"2026-05-26T05:34:02.000Z\"}', 35, '2026-05-26 05:34:02'),
(178, 1, 'transaction', 24, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-03\",\"txnTypeId\":2,\"contactId\":6,\"categoryId\":16,\"subCategoryId\":null,\"notes\":\"Testing\",\"amountLocal\":\"100\",\"amountBase\":\"100\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":35,\"importedStatementId\":3,\"bankTransactionKey\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"100\",\"currencyId\":7},\"entries\":[{\"transactionId\":24,\"accountId\":16,\"debit\":\"100.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":24,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"100.00\",\"description\":\"Paid From\"}]}', 35, '2026-05-26 05:36:04'),
(179, 1, 'transaction', 25, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-03\",\"txnTypeId\":1,\"contactId\":4,\"categoryId\":15,\"subCategoryId\":null,\"notes\":\"\",\"amountLocal\":\"99\",\"amountBase\":\"99\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":35,\"importedStatementId\":3,\"bankTransactionKey\":null,\"isTaxable\":1,\"gstType\":1,\"gstRate\":\"18\",\"cgstAmount\":\"8.91\",\"sgstAmount\":\"8.91\",\"igstAmount\":\"0\",\"gstTotal\":\"17.82\",\"finalAmount\":\"116.82\",\"currencyId\":7},\"entries\":[{\"transactionId\":25,\"accountId\":5,\"debit\":\"116.82\",\"credit\":\"0.00\",\"description\":\"Deposit To\"},{\"transactionId\":25,\"accountId\":15,\"debit\":\"0.00\",\"credit\":\"116.82\",\"description\":\"Income Source\"}]}', 35, '2026-05-26 05:36:04'),
(180, 1, 'transaction', 26, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-04\",\"txnTypeId\":1,\"contactId\":null,\"categoryId\":18,\"subCategoryId\":null,\"notes\":\"TD TO For 925040111874444\",\"amountLocal\":5013624,\"amountBase\":\"5013624\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":35,\"importedStatementId\":3,\"bankTransactionKey\":null,\"isTaxable\":1,\"gstType\":1,\"gstRate\":\"0\",\"cgstAmount\":\"0\",\"sgstAmount\":\"0\",\"igstAmount\":\"0\",\"gstTotal\":\"0\",\"finalAmount\":\"5013624\",\"currencyId\":7},\"entries\":[{\"transactionId\":26,\"accountId\":2,\"debit\":\"5013624.00\",\"credit\":\"0.00\",\"description\":\"Deposit To\"},{\"transactionId\":26,\"accountId\":18,\"debit\":\"0.00\",\"credit\":\"5013624.00\",\"description\":\"Income Source\"}]}', 35, '2026-05-26 05:36:04'),
(181, 1, 'transaction', 26, 'update', '{\"id\":26,\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-04\",\"txnTypeId\":1,\"categoryId\":18,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"TD TO For 925040111874444\",\"currencyId\":7,\"fxRate\":\"1.00000000\",\"amountLocal\":\"5013624.00\",\"amountBase\":\"5013624.00\",\"isTaxable\":true,\"isRcm\":false,\"gstType\":1,\"gstRate\":\"0.00\",\"cgstAmount\":\"0.00\",\"sgstAmount\":\"0.00\",\"igstAmount\":\"0.00\",\"gstTotal\":\"0.00\",\"finalAmount\":\"5013624.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":3,\"bankTransactionKey\":null,\"createdBy\":35,\"createdAt\":\"2026-05-26T05:36:04.000Z\",\"updatedAt\":null,\"transactionType\":{\"id\":1,\"name\":\"Income\"},\"currency\":{\"id\":7,\"code\":\"AED\",\"name\":\"United Arab Emirates Dirham\",\"symbol\":\"AED\",\"status\":1,\"createdAt\":\"2026-04-27T11:16:01.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":1,\"updatedAt\":\"2026-05-26T05:37:04.457Z\",\"createdBy\":35,\"fxRate\":\"1\",\"amountLocal\":4248833.9,\"name\":\"Transaction\",\"txnDate\":\"2026-01-04\",\"txnTypeId\":1,\"categoryId\":18,\"subCategoryId\":null,\"notes\":\"TD TO For 925040111874444\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":1,\"gstType\":1,\"gstRate\":\"18\",\"cgstAmount\":\"382395.05\",\"sgstAmount\":\"382395.05\",\"igstAmount\":\"0\",\"gstTotal\":\"764790.1\",\"finalAmount\":\"5013624\",\"contactId\":null,\"currencyId\":7}', 35, '2026-05-26 05:37:04'),
(182, 1, 'transaction', 26, 'update', '{\"id\":26,\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-04\",\"txnTypeId\":1,\"categoryId\":18,\"subCategoryId\":null,\"contactId\":null,\"notes\":\"TD TO For 925040111874444\",\"currencyId\":7,\"fxRate\":\"1.00000000\",\"amountLocal\":\"4248833.90\",\"amountBase\":\"5013624.00\",\"isTaxable\":true,\"isRcm\":false,\"gstType\":1,\"gstRate\":\"18.00\",\"cgstAmount\":\"382395.05\",\"sgstAmount\":\"382395.05\",\"igstAmount\":\"0.00\",\"gstTotal\":\"764790.10\",\"finalAmount\":\"5013624.00\",\"attachmentPath\":null,\"status\":1,\"importedStatementId\":3,\"bankTransactionKey\":null,\"createdBy\":35,\"createdAt\":\"2026-05-26T05:36:04.000Z\",\"updatedAt\":\"2026-05-26T05:37:04.000Z\",\"transactionType\":{\"id\":1,\"name\":\"Income\"},\"currency\":{\"id\":7,\"code\":\"AED\",\"name\":\"United Arab Emirates Dirham\",\"symbol\":\"AED\",\"status\":1,\"createdAt\":\"2026-04-27T11:16:01.000Z\",\"updatedAt\":null}}', '{\"financialYearId\":1,\"updatedAt\":\"2026-05-26T05:37:15.307Z\",\"createdBy\":35,\"fxRate\":\"0.038491\",\"amountLocal\":5013624,\"name\":\"Transaction\",\"txnDate\":\"2026-01-04\",\"txnTypeId\":1,\"categoryId\":18,\"subCategoryId\":null,\"notes\":\"TD TO For 925040111874444\",\"status\":1,\"attachmentPath\":null,\"isTaxable\":0,\"gstType\":null,\"gstRate\":null,\"cgstAmount\":null,\"sgstAmount\":null,\"igstAmount\":null,\"gstTotal\":null,\"finalAmount\":\"5013624\",\"contactId\":null,\"currencyId\":2}', 35, '2026-05-26 05:37:15'),
(183, 1, 'transaction', 27, 'create', NULL, '{\"header\":{\"orgId\":1,\"branchId\":3,\"financialYearId\":1,\"name\":\"Transaction\",\"txnDate\":\"2026-01-01\",\"txnTypeId\":2,\"contactId\":null,\"categoryId\":17,\"subCategoryId\":null,\"notes\":\"NEFT DR-ICIC0001837-KALPESH PRAVINBHAI P ADSHALA-NETBANK, MUM-HDFCH00707242240-CA PITAL\",\"amountLocal\":\"8000000\",\"amountBase\":\"8000000\",\"fxRate\":\"1\",\"attachmentPath\":null,\"status\":1,\"createdBy\":35,\"importedStatementId\":4,\"bankTransactionKey\":null,\"isTaxable\":1,\"gstType\":1,\"gstRate\":\"18\",\"cgstAmount\":\"720000\",\"sgstAmount\":\"720000\",\"igstAmount\":\"0\",\"gstTotal\":\"1440000\",\"finalAmount\":\"9440000\",\"currencyId\":7},\"entries\":[{\"transactionId\":27,\"accountId\":17,\"debit\":\"9440000.00\",\"credit\":\"0.00\",\"description\":\"Expense\"},{\"transactionId\":27,\"accountId\":2,\"debit\":\"0.00\",\"credit\":\"9440000.00\",\"description\":\"Paid From\"}]}', 35, '2026-05-26 06:11:21');

-- --------------------------------------------------------

--
-- Table structure for table `branches`
--

CREATE TABLE `branches` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL DEFAULT 1,
  `name` varchar(150) NOT NULL,
  `currency_code` char(3) NOT NULL,
  `country` varchar(80) DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `branches`
--

INSERT INTO `branches` (`id`, `org_id`, `name`, `currency_code`, `country`, `status`, `created_at`, `updated_at`) VALUES
(2, 1, 'Jksol Infotech LLP', 'INR', 'India', 1, '2026-04-02 03:59:59', '2026-04-02 04:36:20'),
(3, 1, 'Neon Infotech FZ-LLC', 'AED', 'United Arab Emirates', 1, '2026-04-02 04:00:25', '2026-04-02 04:36:21');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL DEFAULT 1,
  `txn_type_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `org_id`, `txn_type_id`, `name`, `status`, `created_at`) VALUES
(10, 1, 2, 'Domain Charges (Gsuite)', 1, '2026-04-02 11:47:11'),
(11, 1, 1, 'Internet Advertising Revenue', 1, '2026-04-02 11:56:13'),
(12, 1, 2, 'Bank Charge', 1, '2026-04-02 12:13:01'),
(13, 1, 2, 'salary', 1, '2026-04-06 06:35:13'),
(15, 1, 3, 'Mutual Fand- NJ India', 1, '2026-04-10 05:04:00'),
(16, 1, 2, 'Employee Welfair Exp.', 1, '2026-04-10 05:41:57'),
(17, 1, 2, 'Uncategorized Expense', 1, '2026-05-26 05:07:48'),
(18, 1, 1, 'Uncategorized Income', 1, '2026-05-26 05:36:04');

-- --------------------------------------------------------

--
-- Table structure for table `countries`
--

CREATE TABLE `countries` (
  `id` int(11) NOT NULL,
  `country_name` varchar(100) NOT NULL,
  `country_code` char(2) NOT NULL,
  `country_currency` char(3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `countries`
--

INSERT INTO `countries` (`id`, `country_name`, `country_code`, `country_currency`) VALUES
(1, 'Afghanistan', 'AF', 'AFN'),
(2, 'Albania', 'AL', 'ALL'),
(3, 'Algeria', 'DZ', 'DZD'),
(4, 'Andorra', 'AD', 'EUR'),
(5, 'Angola', 'AO', 'AOA'),
(6, 'Antigua and Barbuda', 'AG', 'XCD'),
(7, 'Argentina', 'AR', 'ARS'),
(8, 'Armenia', 'AM', 'AMD'),
(9, 'Australia', 'AU', 'AUD'),
(10, 'Austria', 'AT', 'EUR'),
(11, 'Azerbaijan', 'AZ', 'AZN'),
(12, 'Bahamas', 'BS', 'BSD'),
(13, 'Bahrain', 'BH', 'BHD'),
(14, 'Bangladesh', 'BD', 'BDT'),
(15, 'Barbados', 'BB', 'BBD'),
(16, 'Belarus', 'BY', 'BYN'),
(17, 'Belgium', 'BE', 'EUR'),
(18, 'Belize', 'BZ', 'BZD'),
(19, 'Benin', 'BJ', 'XOF'),
(20, 'Bhutan', 'BT', 'BTN'),
(21, 'Bolivia', 'BO', 'BOB'),
(22, 'Bosnia and Herzegovina', 'BA', 'BAM'),
(23, 'Botswana', 'BW', 'BWP'),
(24, 'Brazil', 'BR', 'BRL'),
(25, 'Brunei', 'BN', 'BND'),
(26, 'Bulgaria', 'BG', 'BGN'),
(27, 'Burkina Faso', 'BF', 'XOF'),
(28, 'Burundi', 'BI', 'BIF'),
(29, 'Cabo Verde', 'CV', 'CVE'),
(30, 'Cambodia', 'KH', 'KHR'),
(31, 'Cameroon', 'CM', 'XAF'),
(32, 'Canada', 'CA', 'CAD'),
(33, 'Central African Republic', 'CF', 'XAF'),
(34, 'Chad', 'TD', 'XAF'),
(35, 'Chile', 'CL', 'CLP'),
(36, 'China', 'CN', 'CNY'),
(37, 'Colombia', 'CO', 'COP'),
(38, 'Comoros', 'KM', 'KMF'),
(39, 'Congo (Congo-Brazzaville)', 'CG', 'XAF'),
(40, 'Costa Rica', 'CR', 'CRC'),
(41, 'Croatia', 'HR', 'EUR'),
(42, 'Cuba', 'CU', 'CUP'),
(43, 'Cyprus', 'CY', 'EUR'),
(44, 'Czechia', 'CZ', 'CZK'),
(45, 'Denmark', 'DK', 'DKK'),
(46, 'Djibouti', 'DJ', 'DJF'),
(47, 'Dominica', 'DM', 'XCD'),
(48, 'Dominican Republic', 'DO', 'DOP'),
(49, 'Ecuador', 'EC', 'USD'),
(50, 'Egypt', 'EG', 'EGP'),
(51, 'El Salvador', 'SV', 'USD'),
(52, 'Equatorial Guinea', 'GQ', 'XAF'),
(53, 'Eritrea', 'ER', 'ERN'),
(54, 'Estonia', 'EE', 'EUR'),
(55, 'Eswatini', 'SZ', 'SZL'),
(56, 'Ethiopia', 'ET', 'ETB'),
(57, 'Fiji', 'FJ', 'FJD'),
(58, 'Finland', 'FI', 'EUR'),
(59, 'France', 'FR', 'EUR'),
(60, 'Gabon', 'GA', 'XAF'),
(61, 'Gambia', 'GM', 'GMD'),
(62, 'Georgia', 'GE', 'GEL'),
(63, 'Germany', 'DE', 'EUR'),
(64, 'Ghana', 'GH', 'GHS'),
(65, 'Greece', 'GR', 'EUR'),
(66, 'Grenada', 'GD', 'XCD'),
(67, 'Guatemala', 'GT', 'GTQ'),
(68, 'Guinea', 'GN', 'GNF'),
(69, 'Guinea-Bissau', 'GW', 'XOF'),
(70, 'Guyana', 'GY', 'GYD'),
(71, 'Haiti', 'HT', 'HTG'),
(72, 'Honduras', 'HN', 'HNL'),
(73, 'Hungary', 'HU', 'HUF'),
(74, 'Iceland', 'IS', 'ISK'),
(75, 'India', 'IN', 'INR'),
(76, 'Indonesia', 'ID', 'IDR'),
(77, 'Iran', 'IR', 'IRR'),
(78, 'Iraq', 'IQ', 'IQD'),
(79, 'Ireland', 'IE', 'EUR'),
(80, 'Israel', 'IL', 'ILS'),
(81, 'Italy', 'IT', 'EUR'),
(82, 'Jamaica', 'JM', 'JMD'),
(83, 'Japan', 'JP', 'JPY'),
(84, 'Jordan', 'JO', 'JOD'),
(85, 'Kazakhstan', 'KZ', 'KZT'),
(86, 'Kenya', 'KE', 'KES'),
(87, 'Kiribati', 'KI', 'AUD'),
(88, 'Kuwait', 'KW', 'KWD'),
(89, 'Kyrgyzstan', 'KG', 'KGS'),
(90, 'Laos', 'LA', 'LAK'),
(91, 'Latvia', 'LV', 'EUR'),
(92, 'Lebanon', 'LB', 'LBP'),
(93, 'Lesotho', 'LS', 'LSL'),
(94, 'Liberia', 'LR', 'LRD'),
(95, 'Libya', 'LY', 'LYD'),
(96, 'Liechtenstein', 'LI', 'CHF'),
(97, 'Lithuania', 'LT', 'EUR'),
(98, 'Luxembourg', 'LU', 'EUR'),
(99, 'Madagascar', 'MG', 'MGA'),
(100, 'Malawi', 'MW', 'MWK'),
(101, 'Malaysia', 'MY', 'MYR'),
(102, 'Maldives', 'MV', 'MVR'),
(103, 'Mali', 'ML', 'XOF'),
(104, 'Malta', 'MT', 'EUR'),
(105, 'Marshall Islands', 'MH', 'USD'),
(106, 'Mauritania', 'MR', 'MRU'),
(107, 'Mauritius', 'MU', 'MUR'),
(108, 'Mexico', 'MX', 'MXN'),
(109, 'Micronesia', 'FM', 'USD'),
(110, 'Moldova', 'MD', 'MDL'),
(111, 'Monaco', 'MC', 'EUR'),
(112, 'Mongolia', 'MN', 'MNT'),
(113, 'Montenegro', 'ME', 'EUR'),
(114, 'Morocco', 'MA', 'MAD'),
(115, 'Mozambique', 'MZ', 'MZN'),
(116, 'Myanmar', 'MM', 'MMK'),
(117, 'Namibia', 'NA', 'NAD'),
(118, 'Nauru', 'NR', 'AUD'),
(119, 'Nepal', 'NP', 'NPR'),
(120, 'Netherlands', 'NL', 'EUR'),
(121, 'New Zealand', 'NZ', 'NZD'),
(122, 'Nicaragua', 'NI', 'NIO'),
(123, 'Niger', 'NE', 'XOF'),
(124, 'Nigeria', 'NG', 'NGN'),
(125, 'North Korea', 'KP', 'KPW'),
(126, 'North Macedonia', 'MK', 'MKD'),
(127, 'Norway', 'NO', 'NOK'),
(128, 'Oman', 'OM', 'OMR'),
(129, 'Pakistan', 'PK', 'PKR'),
(130, 'Palau', 'PW', 'USD'),
(131, 'Panama', 'PA', 'PAB'),
(132, 'Papua New Guinea', 'PG', 'PGK'),
(133, 'Paraguay', 'PY', 'PYG'),
(134, 'Peru', 'PE', 'PEN'),
(135, 'Philippines', 'PH', 'PHP'),
(136, 'Poland', 'PL', 'PLN'),
(137, 'Portugal', 'PT', 'EUR'),
(138, 'Qatar', 'QA', 'QAR'),
(139, 'Romania', 'RO', 'RON'),
(140, 'Russia', 'RU', 'RUB'),
(141, 'Rwanda', 'RW', 'RWF'),
(142, 'Saint Kitts and Nevis', 'KN', 'XCD'),
(143, 'Saint Lucia', 'LC', 'XCD'),
(144, 'Saint Vincent and the Grenadines', 'VC', 'XCD'),
(145, 'Samoa', 'WS', 'WST'),
(146, 'San Marino', 'SM', 'EUR'),
(147, 'Sao Tome and Principe', 'ST', 'STN'),
(148, 'Saudi Arabia', 'SA', 'SAR'),
(149, 'Senegal', 'SN', 'XOF'),
(150, 'Serbia', 'RS', 'RSD'),
(151, 'Seychelles', 'SC', 'SCR'),
(152, 'Sierra Leone', 'SL', 'SLL'),
(153, 'Singapore', 'SG', 'SGD'),
(154, 'Slovakia', 'SK', 'EUR'),
(155, 'Slovenia', 'SI', 'EUR'),
(156, 'Solomon Islands', 'SB', 'SBD'),
(157, 'Somalia', 'SO', 'SOS'),
(158, 'South Africa', 'ZA', 'ZAR'),
(159, 'South Korea', 'KR', 'KRW'),
(160, 'South Sudan', 'SS', 'SSP'),
(161, 'Spain', 'ES', 'EUR'),
(162, 'Sri Lanka', 'LK', 'LKR'),
(163, 'Sudan', 'SD', 'SDG'),
(164, 'Suriname', 'SR', 'SRD'),
(165, 'Sweden', 'SE', 'SEK'),
(166, 'Switzerland', 'CH', 'CHF'),
(167, 'Syria', 'SY', 'SYP'),
(168, 'Taiwan', 'TW', 'TWD'),
(169, 'Tajikistan', 'TJ', 'TJS'),
(170, 'Tanzania', 'TZ', 'TZS'),
(171, 'Thailand', 'TH', 'THB'),
(172, 'Timor-Leste', 'TL', 'USD'),
(173, 'Togo', 'TG', 'XOF'),
(174, 'Tonga', 'TO', 'TOP'),
(175, 'Trinidad and Tobago', 'TT', 'TTD'),
(176, 'Tunisia', 'TN', 'TND'),
(177, 'Turkey', 'TR', 'TRY'),
(178, 'Turkmenistan', 'TM', 'TMT'),
(179, 'Tuvalu', 'TV', 'AUD'),
(180, 'Uganda', 'UG', 'UGX'),
(181, 'Ukraine', 'UA', 'UAH'),
(182, 'United Arab Emirates', 'AE', 'AED'),
(183, 'United Kingdom', 'GB', 'GBP'),
(184, 'United States', 'US', 'USD'),
(185, 'Uruguay', 'UY', 'UYU'),
(186, 'Uzbekistan', 'UZ', 'UZS'),
(187, 'Vanuatu', 'VU', 'VUV'),
(188, 'Vatican City', 'VA', 'EUR'),
(189, 'Venezuela', 'VE', 'VES'),
(190, 'Vietnam', 'VN', 'VND'),
(191, 'Yemen', 'YE', 'YER'),
(192, 'Zambia', 'ZM', 'ZMW'),
(193, 'Zimbabwe', 'ZW', 'ZWL');

-- --------------------------------------------------------

--
-- Table structure for table `currencies`
--

CREATE TABLE `currencies` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(3) NOT NULL,
  `name` varchar(50) NOT NULL,
  `symbol` varchar(5) DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `currencies`
--

INSERT INTO `currencies` (`id`, `code`, `name`, `symbol`, `status`, `created_at`, `updated_at`) VALUES
(1, 'USD', 'US Dollar', '$', 1, '2026-02-18 11:06:34', NULL),
(2, 'INR', 'Indian Rupee', '₹', 1, '2026-02-18 11:06:34', NULL),
(3, 'EUR', 'Euro', '€', 1, '2026-02-18 11:06:34', NULL),
(4, 'GBP', 'British Pound', '£', 1, '2026-02-18 11:06:34', NULL),
(5, 'AUD', 'Australian Dollar', 'A$', 1, '2026-02-18 11:06:34', NULL),
(6, 'CAD', 'Canadian Dollar', 'C$', 1, '2026-02-18 11:06:34', NULL),
(7, 'AED', 'United Arab Emirates Dirham', 'AED', 1, '2026-04-27 11:16:01', NULL),
(8, 'JPY', 'Japanese Yen', '¥', 1, '2026-04-27 11:16:01', NULL),
(9, 'SGD', 'Singapore Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(10, 'AFN', 'Afghan Afghani', '؋', 1, '2026-04-27 11:16:01', NULL),
(11, 'ALL', 'Albanian Lek', 'ALL', 1, '2026-04-27 11:16:01', NULL),
(12, 'DZD', 'Algerian Dinar', 'DZD', 1, '2026-04-27 11:16:01', NULL),
(13, 'AOA', 'Angolan Kwanza', 'Kz', 1, '2026-04-27 11:16:01', NULL),
(14, 'XCD', 'East Caribbean Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(15, 'ARS', 'Argentine Peso', '$', 1, '2026-04-27 11:16:01', NULL),
(16, 'AMD', 'Armenian Dram', '֏', 1, '2026-04-27 11:16:01', NULL),
(17, 'AZN', 'Azerbaijani Manat', '₼', 1, '2026-04-27 11:16:01', NULL),
(18, 'BSD', 'Bahamian Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(19, 'BHD', 'Bahraini Dinar', 'BHD', 1, '2026-04-27 11:16:01', NULL),
(20, 'BDT', 'Bangladeshi Taka', '৳', 1, '2026-04-27 11:16:01', NULL),
(21, 'BBD', 'Barbadian Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(22, 'BYN', 'Belarusian Ruble', 'BYN', 1, '2026-04-27 11:16:01', NULL),
(23, 'BZD', 'Belize Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(24, 'XOF', 'West African CFA Franc', 'F CFA', 1, '2026-04-27 11:16:01', NULL),
(25, 'BTN', 'Bhutanese Ngultrum', 'BTN', 1, '2026-04-27 11:16:01', NULL),
(26, 'BOB', 'Bolivian Boliviano', 'Bs', 1, '2026-04-27 11:16:01', NULL),
(27, 'BAM', 'Bosnia-Herzegovina Convertible Mark', 'KM', 1, '2026-04-27 11:16:01', NULL),
(28, 'BWP', 'Botswanan Pula', 'P', 1, '2026-04-27 11:16:01', NULL),
(29, 'BRL', 'Brazilian Real', 'R$', 1, '2026-04-27 11:16:01', NULL),
(30, 'BND', 'Brunei Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(31, 'BGN', 'Bulgarian Lev', 'BGN', 1, '2026-04-27 11:16:01', NULL),
(32, 'BIF', 'Burundian Franc', 'BIF', 1, '2026-04-27 11:16:01', NULL),
(33, 'CVE', 'Cape Verdean Escudo', 'CVE', 1, '2026-04-27 11:16:01', NULL),
(34, 'KHR', 'Cambodian Riel', '៛', 1, '2026-04-27 11:16:01', NULL),
(35, 'XAF', 'Central African CFA Franc', 'FCFA', 1, '2026-04-27 11:16:01', NULL),
(36, 'CLP', 'Chilean Peso', '$', 1, '2026-04-27 11:16:01', NULL),
(37, 'CNY', 'Chinese Yuan', '¥', 1, '2026-04-27 11:16:01', NULL),
(38, 'COP', 'Colombian Peso', '$', 1, '2026-04-27 11:16:01', NULL),
(39, 'KMF', 'Comorian Franc', 'CF', 1, '2026-04-27 11:16:01', NULL),
(40, 'CRC', 'Costa Rican Colón', '₡', 1, '2026-04-27 11:16:01', NULL),
(41, 'CUP', 'Cuban Peso', '$', 1, '2026-04-27 11:16:01', NULL),
(42, 'CZK', 'Czech Koruna', 'Kč', 1, '2026-04-27 11:16:01', NULL),
(43, 'DKK', 'Danish Krone', 'kr', 1, '2026-04-27 11:16:01', NULL),
(44, 'DJF', 'Djiboutian Franc', 'DJF', 1, '2026-04-27 11:16:01', NULL),
(45, 'DOP', 'Dominican Peso', '$', 1, '2026-04-27 11:16:01', NULL),
(46, 'EGP', 'Egyptian Pound', 'E£', 1, '2026-04-27 11:16:01', NULL),
(47, 'ERN', 'Eritrean Nakfa', 'ERN', 1, '2026-04-27 11:16:01', NULL),
(48, 'SZL', 'Swazi Lilangeni', 'SZL', 1, '2026-04-27 11:16:01', NULL),
(49, 'ETB', 'Ethiopian Birr', 'ETB', 1, '2026-04-27 11:16:01', NULL),
(50, 'FJD', 'Fijian Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(51, 'GMD', 'Gambian Dalasi', 'GMD', 1, '2026-04-27 11:16:01', NULL),
(52, 'GEL', 'Georgian Lari', '₾', 1, '2026-04-27 11:16:01', NULL),
(53, 'GHS', 'Ghanaian Cedi', 'GH₵', 1, '2026-04-27 11:16:01', NULL),
(54, 'GTQ', 'Guatemalan Quetzal', 'Q', 1, '2026-04-27 11:16:01', NULL),
(55, 'GNF', 'Guinean Franc', 'FG', 1, '2026-04-27 11:16:01', NULL),
(56, 'GYD', 'Guyanaese Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(57, 'HTG', 'Haitian Gourde', 'HTG', 1, '2026-04-27 11:16:01', NULL),
(58, 'HNL', 'Honduran Lempira', 'L', 1, '2026-04-27 11:16:01', NULL),
(59, 'HUF', 'Hungarian Forint', 'Ft', 1, '2026-04-27 11:16:01', NULL),
(60, 'ISK', 'Icelandic Króna', 'kr', 1, '2026-04-27 11:16:01', NULL),
(61, 'IDR', 'Indonesian Rupiah', 'Rp', 1, '2026-04-27 11:16:01', NULL),
(62, 'IRR', 'Iranian Rial', 'IRR', 1, '2026-04-27 11:16:01', NULL),
(63, 'IQD', 'Iraqi Dinar', 'IQD', 1, '2026-04-27 11:16:01', NULL),
(64, 'ILS', 'Israeli New Shekel', '₪', 1, '2026-04-27 11:16:01', NULL),
(65, 'JMD', 'Jamaican Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(66, 'JOD', 'Jordanian Dinar', 'JOD', 1, '2026-04-27 11:16:01', NULL),
(67, 'KZT', 'Kazakhstani Tenge', '₸', 1, '2026-04-27 11:16:01', NULL),
(68, 'KES', 'Kenyan Shilling', 'KES', 1, '2026-04-27 11:16:01', NULL),
(69, 'KWD', 'Kuwaiti Dinar', 'KWD', 1, '2026-04-27 11:16:01', NULL),
(70, 'KGS', 'Kyrgystani Som', '⃀', 1, '2026-04-27 11:16:01', NULL),
(71, 'LAK', 'Laotian Kip', '₭', 1, '2026-04-27 11:16:01', NULL),
(72, 'LBP', 'Lebanese Pound', 'L£', 1, '2026-04-27 11:16:01', NULL),
(73, 'LSL', 'Lesotho Loti', 'LSL', 1, '2026-04-27 11:16:01', NULL),
(74, 'LRD', 'Liberian Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(75, 'LYD', 'Libyan Dinar', 'LYD', 1, '2026-04-27 11:16:01', NULL),
(76, 'CHF', 'Swiss Franc', 'CHF', 1, '2026-04-27 11:16:01', NULL),
(77, 'MGA', 'Malagasy Ariary', 'Ar', 1, '2026-04-27 11:16:01', NULL),
(78, 'MWK', 'Malawian Kwacha', 'MWK', 1, '2026-04-27 11:16:01', NULL),
(79, 'MYR', 'Malaysian Ringgit', 'RM', 1, '2026-04-27 11:16:01', NULL),
(80, 'MVR', 'Maldivian Rufiyaa', 'MVR', 1, '2026-04-27 11:16:01', NULL),
(81, 'MRU', 'Mauritanian Ouguiya', 'MRU', 1, '2026-04-27 11:16:01', NULL),
(82, 'MUR', 'Mauritian Rupee', 'Rs', 1, '2026-04-27 11:16:01', NULL),
(83, 'MXN', 'Mexican Peso', '$', 1, '2026-04-27 11:16:01', NULL),
(84, 'MDL', 'Moldovan Leu', 'MDL', 1, '2026-04-27 11:16:01', NULL),
(85, 'MNT', 'Mongolian Tugrik', '₮', 1, '2026-04-27 11:16:01', NULL),
(86, 'MAD', 'Moroccan Dirham', 'MAD', 1, '2026-04-27 11:16:01', NULL),
(87, 'MZN', 'Mozambican Metical', 'MZN', 1, '2026-04-27 11:16:01', NULL),
(88, 'MMK', 'Myanmar Kyat', 'K', 1, '2026-04-27 11:16:01', NULL),
(89, 'NAD', 'Namibian Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(90, 'NPR', 'Nepalese Rupee', 'Rs', 1, '2026-04-27 11:16:01', NULL),
(91, 'NZD', 'New Zealand Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(92, 'NIO', 'Nicaraguan Córdoba', 'C$', 1, '2026-04-27 11:16:01', NULL),
(93, 'NGN', 'Nigerian Naira', '₦', 1, '2026-04-27 11:16:01', NULL),
(94, 'KPW', 'North Korean Won', '₩', 1, '2026-04-27 11:16:01', NULL),
(95, 'MKD', 'Macedonian Denar', 'MKD', 1, '2026-04-27 11:16:01', NULL),
(96, 'NOK', 'Norwegian Krone', 'kr', 1, '2026-04-27 11:16:01', NULL),
(97, 'OMR', 'Omani Rial', 'OMR', 1, '2026-04-27 11:16:01', NULL),
(98, 'PKR', 'Pakistani Rupee', 'Rs', 1, '2026-04-27 11:16:01', NULL),
(99, 'PAB', 'Panamanian Balboa', 'PAB', 1, '2026-04-27 11:16:01', NULL),
(100, 'PGK', 'Papua New Guinean Kina', 'PGK', 1, '2026-04-27 11:16:01', NULL),
(101, 'PYG', 'Paraguayan Guarani', '₲', 1, '2026-04-27 11:16:01', NULL),
(102, 'PEN', 'Peruvian Sol', 'PEN', 1, '2026-04-27 11:16:01', NULL),
(103, 'PHP', 'Philippine Peso', '₱', 1, '2026-04-27 11:16:01', NULL),
(104, 'PLN', 'Polish Zloty', 'zł', 1, '2026-04-27 11:16:01', NULL),
(105, 'QAR', 'Qatari Riyal', 'QAR', 1, '2026-04-27 11:16:01', NULL),
(106, 'RON', 'Romanian Leu', 'lei', 1, '2026-04-27 11:16:01', NULL),
(107, 'RUB', 'Russian Ruble', '₽', 1, '2026-04-27 11:16:01', NULL),
(108, 'RWF', 'Rwandan Franc', 'RF', 1, '2026-04-27 11:16:01', NULL),
(109, 'WST', 'Samoan Tala', 'WST', 1, '2026-04-27 11:16:01', NULL),
(110, 'STN', 'São Tomé & Príncipe Dobra', 'Db', 1, '2026-04-27 11:16:01', NULL),
(111, 'SAR', 'Saudi Riyal', 'SAR', 1, '2026-04-27 11:16:01', NULL),
(112, 'RSD', 'Serbian Dinar', 'RSD', 1, '2026-04-27 11:16:01', NULL),
(113, 'SCR', 'Seychellois Rupee', 'SCR', 1, '2026-04-27 11:16:01', NULL),
(114, 'SLL', 'Sierra Leonean Leone (1964—2022)', 'SLL', 1, '2026-04-27 11:16:01', NULL),
(115, 'SBD', 'Solomon Islands Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(116, 'SOS', 'Somali Shilling', 'SOS', 1, '2026-04-27 11:16:01', NULL),
(117, 'ZAR', 'South African Rand', 'R', 1, '2026-04-27 11:16:01', NULL),
(118, 'KRW', 'South Korean Won', '₩', 1, '2026-04-27 11:16:01', NULL),
(119, 'SSP', 'South Sudanese Pound', '£', 1, '2026-04-27 11:16:01', NULL),
(120, 'LKR', 'Sri Lankan Rupee', 'Rs', 1, '2026-04-27 11:16:01', NULL),
(121, 'SDG', 'Sudanese Pound', 'SDG', 1, '2026-04-27 11:16:01', NULL),
(122, 'SRD', 'Surinamese Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(123, 'SEK', 'Swedish Krona', 'kr', 1, '2026-04-27 11:16:01', NULL),
(124, 'SYP', 'Syrian Pound', '£', 1, '2026-04-27 11:16:01', NULL),
(125, 'TWD', 'New Taiwan Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(126, 'TJS', 'Tajikistani Somoni', 'TJS', 1, '2026-04-27 11:16:01', NULL),
(127, 'TZS', 'Tanzanian Shilling', 'TZS', 1, '2026-04-27 11:16:01', NULL),
(128, 'THB', 'Thai Baht', '฿', 1, '2026-04-27 11:16:01', NULL),
(129, 'TOP', 'Tongan Paʻanga', 'T$', 1, '2026-04-27 11:16:01', NULL),
(130, 'TTD', 'Trinidad & Tobago Dollar', '$', 1, '2026-04-27 11:16:01', NULL),
(131, 'TND', 'Tunisian Dinar', 'TND', 1, '2026-04-27 11:16:01', NULL),
(132, 'TRY', 'Turkish Lira', '₺', 1, '2026-04-27 11:16:01', NULL),
(133, 'TMT', 'Turkmenistani Manat', 'TMT', 1, '2026-04-27 11:16:01', NULL),
(134, 'UGX', 'Ugandan Shilling', 'UGX', 1, '2026-04-27 11:16:01', NULL),
(135, 'UAH', 'Ukrainian Hryvnia', '₴', 1, '2026-04-27 11:16:01', NULL),
(136, 'UYU', 'Uruguayan Peso', '$', 1, '2026-04-27 11:16:01', NULL),
(137, 'UZS', 'Uzbekistani Som', 'UZS', 1, '2026-04-27 11:16:01', NULL),
(138, 'VUV', 'Vanuatu Vatu', 'VUV', 1, '2026-04-27 11:16:01', NULL),
(139, 'VES', 'Venezuelan Bolívar', 'VES', 1, '2026-04-27 11:16:01', NULL),
(140, 'VND', 'Vietnamese Dong', '₫', 1, '2026-04-27 11:16:01', NULL),
(141, 'YER', 'Yemeni Rial', 'YER', 1, '2026-04-27 11:16:01', NULL),
(142, 'ZMW', 'Zambian Kwacha', 'ZK', 1, '2026-04-27 11:16:01', NULL),
(143, 'ZWL', 'Zimbabwean Dollar (2009)', 'ZWL', 1, '2026-04-27 11:16:01', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `exchange_rates`
--

CREATE TABLE `exchange_rates` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL,
  `rate_date` date NOT NULL,
  `from_currency` char(3) NOT NULL,
  `to_currency` char(3) NOT NULL,
  `rate` decimal(18,8) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `exchange_rates`
--

INSERT INTO `exchange_rates` (`id`, `org_id`, `rate_date`, `from_currency`, `to_currency`, `rate`, `created_at`) VALUES
(1, 1, '2026-04-02', 'AED', 'INR', 25.47384600, '2026-04-02 10:25:26'),
(2, 1, '2026-04-02', 'USD', 'INR', 93.43000000, '2026-04-02 10:25:28'),
(3, 1, '2026-04-03', 'USD', 'INR', 93.10000000, '2026-04-03 10:29:55'),
(4, 1, '2026-04-06', 'AED', 'INR', 25.35761500, '2026-04-06 03:26:54'),
(5, 1, '2026-04-06', 'USD', 'INR', 93.10000000, '2026-04-06 04:00:10'),
(6, 1, '2026-04-06', 'INR', 'USD', 0.01074000, '2026-04-06 04:05:50'),
(10, 1, '2026-04-07', 'USD', 'INR', 93.10000000, '2026-04-07 03:04:46'),
(11, 1, '2026-04-08', 'USD', 'INR', 93.01000000, '2026-04-08 09:23:32'),
(12, 1, '2026-04-08', 'USD', 'AED', 3.67250000, '2026-04-08 10:39:34'),
(13, 1, '2026-04-10', 'USD', 'INR', 92.66000000, '2026-04-10 04:45:15'),
(14, 1, '2026-04-10', 'INR', 'AED', 0.03956900, '2026-04-10 05:43:53'),
(15, 1, '2026-04-10', 'USD', 'AED', 3.67250000, '2026-04-10 05:43:58'),
(16, 1, '2026-04-10', 'INR', 'USD', 0.01079000, '2026-04-10 05:47:31'),
(21, 1, '2026-04-11', 'USD', 'INR', 92.89000000, '2026-04-11 02:54:19'),
(26, 1, '2026-04-13', 'INR', 'USD', 0.01077000, '2026-04-13 03:56:33'),
(32, 1, '2026-04-13', 'USD', 'INR', 92.89000000, '2026-04-13 03:57:05'),
(37, 1, '2026-04-14', 'USD', 'INR', 93.33000000, '2026-04-14 06:21:45'),
(43, 1, '2026-04-15', 'USD', 'INR', 93.09000000, '2026-04-15 09:59:06'),
(47, 1, '2026-04-22', 'USD', 'INR', 93.51000000, '2026-04-22 04:17:39'),
(52, 1, '2026-04-24', 'USD', 'INR', 94.11000000, '2026-04-24 09:54:26'),
(55, 1, '2026-04-27', 'USD', 'INR', 94.15978800, '2026-04-27 11:16:12'),
(61, 1, '2026-04-28', 'USD', 'INR', 94.53421800, '2026-04-28 08:01:59'),
(74, 1, '2026-04-28', 'INR', 'USD', 0.01058100, '2026-04-28 06:26:02'),
(81, 1, '2026-04-28', 'USD', 'AED', 3.67250000, '2026-04-28 07:57:07'),
(83, 1, '2026-04-29', 'USD', 'INR', 94.78573800, '2026-04-29 07:11:21'),
(90, 1, '2026-04-29', 'USD', 'AED', 3.67250000, '2026-04-29 04:43:53'),
(104, 1, '2026-04-30', 'USD', 'INR', 95.28117800, '2026-04-30 07:09:03'),
(105, 1, '2026-05-04', 'USD', 'INR', 94.92295900, '2026-05-04 06:32:37'),
(107, 1, '2026-05-23', 'USD', 'INR', 95.69968500, '2026-05-23 06:19:19'),
(108, 1, '2026-05-23', 'INR', 'AED', 0.03837500, '2026-05-23 06:22:28'),
(109, 1, '2026-05-23', 'USD', 'AED', 3.67250000, '2026-05-23 06:22:41'),
(110, 1, '2026-05-25', 'USD', 'INR', 95.21971000, '2026-05-25 11:40:12'),
(116, 1, '2026-05-26', 'USD', 'INR', 95.42251600, '2026-05-26 06:20:49'),
(118, 1, '2026-05-26', 'USD', 'AED', 3.67250000, '2026-05-26 04:32:27'),
(124, 1, '2026-05-26', 'AED', 'INR', 25.98298600, '2026-05-26 06:20:49'),
(147, 1, '2026-05-26', 'AED', 'USD', 0.27229400, '2026-05-26 05:24:43'),
(148, 1, '2026-05-26', 'INR', 'USD', 0.01048300, '2026-05-26 05:24:43'),
(159, 1, '2026-05-26', 'INR', 'AED', 0.03849100, '2026-05-26 05:37:11');

-- --------------------------------------------------------

--
-- Table structure for table `financial_years`
--

CREATE TABLE `financial_years` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL DEFAULT 1,
  `name` varchar(30) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `financial_years`
--

INSERT INTO `financial_years` (`id`, `org_id`, `name`, `start_date`, `end_date`, `created_at`, `updated_at`) VALUES
(1, 1, '2025-26', '2025-04-01', '2026-03-31', '2026-02-18 04:12:31', '2026-04-02 03:22:17'),
(2, 1, '2026-27', '2026-04-01', '2027-03-31', '2026-02-18 04:12:31', '2026-04-02 03:22:21');

-- --------------------------------------------------------

--
-- Table structure for table `imported_statements`
--

CREATE TABLE `imported_statements` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL,
  `branch_id` bigint(20) UNSIGNED NOT NULL,
  `financial_year_id` bigint(20) UNSIGNED NOT NULL,
  `filename` varchar(255) NOT NULL,
  `target_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `imported_by` bigint(20) UNSIGNED NOT NULL,
  `imported_at` datetime NOT NULL DEFAULT current_timestamp(),
  `transaction_count` int(11) NOT NULL DEFAULT 0,
  `status` int(11) NOT NULL DEFAULT 1,
  `file_hash` varchar(64) DEFAULT NULL,
  `statement_fingerprint` varchar(64) DEFAULT NULL,
  `parser_type` varchar(50) DEFAULT NULL,
  `validation_status` varchar(20) DEFAULT NULL,
  `duplicate_count` int(11) DEFAULT 0,
  `invalid_count` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `imported_statements`
--

INSERT INTO `imported_statements` (`id`, `org_id`, `branch_id`, `financial_year_id`, `filename`, `target_account_id`, `imported_by`, `imported_at`, `transaction_count`, `status`, `file_hash`, `statement_fingerprint`, `parser_type`, `validation_status`, `duplicate_count`, `invalid_count`) VALUES
(1, 1, 3, 2, 'dump.pdf', NULL, 35, '2026-05-26 03:58:57', 1, 0, NULL, NULL, NULL, NULL, 0, 0),
(2, 1, 3, 2, 'dump.pdf', NULL, 35, '2026-05-26 05:07:48', 1, 0, NULL, NULL, NULL, NULL, 0, 0),
(3, 1, 3, 2, 'AXIS.pdf', NULL, 35, '2026-05-26 05:36:04', 3, 0, NULL, NULL, NULL, NULL, 0, 0),
(4, 1, 3, 2, 'dump.pdf', NULL, 35, '2026-05-26 06:11:21', 1, 1, NULL, NULL, NULL, NULL, 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `organizations`
--

CREATE TABLE `organizations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `logo` longtext DEFAULT NULL,
  `base_currency` char(3) NOT NULL DEFAULT 'USD',
  `timezone` varchar(64) NOT NULL DEFAULT 'Asia/Kolkata',
  `status` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `organizations`
--

INSERT INTO `organizations` (`id`, `name`, `logo`, `base_currency`, `timezone`, `status`, `created_at`, `updated_at`) VALUES
(1, 'JKSOL', NULL, 'INR', 'Asia/Kolkata', 1, '2026-04-02 03:18:24', '2026-05-26 05:34:02');

-- --------------------------------------------------------

--
-- Table structure for table `parties`
--

CREATE TABLE `parties` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(190) NOT NULL,
  `phone` varchar(40) NOT NULL,
  `address` text NOT NULL,
  `gst_no` varchar(50) NOT NULL,
  `gst_name` varchar(255) NOT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `parties`
--

INSERT INTO `parties` (`id`, `company_name`, `org_id`, `name`, `email`, `phone`, `address`, `gst_no`, `gst_name`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(3, 'Google India Pvt. LTD (Gsuite)', 1, '', '', '', 'Tower B, Unitech Signature Tower II,Sector 15, Part I, Village Silokhera,Gurugram, Haryana 122002,India', '06AACCG0527D1Z8', 'Google India Pvt. LTD (Gsuite)', 1, 5, '2026-04-02 11:46:36', NULL),
(4, 'Google Asia Pvt LTD', 1, '', '', '', '70 Pasir Panjang Road, #03-71,Mapletree Business City,,Singapore 117371', '', '', 1, 5, '2026-04-02 11:55:13', NULL),
(5, 'Cell Rebel AB', 1, '', '', '', '', '', '', 1, 5, '2026-04-03 10:16:28', NULL),
(6, 'NJ India', 1, '', '', '', '', '', '', 1, 5, '2026-04-10 05:01:28', '2026-05-26 04:45:38');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`) VALUES
(2, 'Admin'),
(3, 'Member'),
(1, 'Owner'),
(4, 'Viewer');

-- --------------------------------------------------------

--
-- Table structure for table `sub_categories`
--

CREATE TABLE `sub_categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `category_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sub_categories`
--

INSERT INTO `sub_categories` (`id`, `category_id`, `name`, `status`, `created_at`) VALUES
(7, 10, 'Google Workspace', 1, '2026-04-06 11:10:05'),
(9, 15, 'Axia Mid Cap 50', 1, '2026-04-10 05:04:23');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

CREATE TABLE `transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `org_id` bigint(20) UNSIGNED NOT NULL DEFAULT 1,
  `branch_id` bigint(20) UNSIGNED NOT NULL,
  `financial_year_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL DEFAULT 'Transaction',
  `txn_date` date NOT NULL,
  `txn_type_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `fx_rate` decimal(18,8) NOT NULL DEFAULT 1.00000000,
  `amount_local` decimal(18,2) NOT NULL DEFAULT 0.00,
  `amount_base` decimal(18,2) NOT NULL DEFAULT 0.00,
  `attachment_path` varchar(255) DEFAULT NULL,
  `currency_id` bigint(20) UNSIGNED DEFAULT NULL,
  `category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `sub_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `is_taxable` tinyint(1) NOT NULL DEFAULT 0,
  `gst_type` int(11) DEFAULT NULL,
  `gst_rate` decimal(5,2) DEFAULT NULL,
  `cgst_amount` decimal(12,2) DEFAULT NULL,
  `sgst_amount` decimal(12,2) DEFAULT NULL,
  `igst_amount` decimal(12,2) DEFAULT NULL,
  `gst_total` decimal(12,2) DEFAULT NULL,
  `is_rcm` tinyint(1) NOT NULL DEFAULT 0,
  `final_amount` decimal(12,2) DEFAULT NULL,
  `contact_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 0,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `bank_transaction_key` varchar(64) DEFAULT NULL,
  `imported_statement_id` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transactions`
--

INSERT INTO `transactions` (`id`, `org_id`, `branch_id`, `financial_year_id`, `name`, `txn_date`, `txn_type_id`, `notes`, `fx_rate`, `amount_local`, `amount_base`, `attachment_path`, `currency_id`, `category_id`, `sub_category_id`, `is_taxable`, `gst_type`, `gst_rate`, `cgst_amount`, `sgst_amount`, `igst_amount`, `gst_total`, `is_rcm`, `final_amount`, `contact_id`, `status`, `created_by`, `created_at`, `updated_at`, `bank_transaction_key`, `imported_statement_id`) VALUES
(7, 1, 2, 1, '', '2026-03-02', 4, 'NEFT CR-ICIC0SF0002-JKSOL INFOTECH LLP-JKSOL INFOTECH LLP-IN42606153878574\n', 1.00000000, 100000.00, 100000.00, NULL, 2, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 100000.00, NULL, 1, 5, '2026-04-02 11:39:02', '2026-04-02 12:07:21', NULL, NULL),
(8, 1, 2, 1, 'Google India Pvt. LTD (Gsuite)', '2026-03-03', 2, 'ME DC SI 403875XXXXXX7554 GOOGLE WORKSPACE CYBS\r\nFeb.-2026 Invoice Payment', 1.00000000, 1534.00, 1534.00, '/uploads/transactions/6bec0878-4c84-408b-a044-61e8abb7baab-03_Google Gsuite ID-0237 ( Rs. 1534).pdf', 2, 10, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1534.00, 3, 1, 5, '2026-04-02 11:49:05', NULL, NULL, NULL),
(9, 1, 2, 1, 'Google India Pvt. LTD (Gsuite)', '2026-03-03', 2, 'ME DC SI 403875XXXXXX7554 GOOGLE WORKSPACE CYBS\r\nFeb.-2026 invoice payment', 1.00000000, 1534.00, 1534.00, '/uploads/transactions/5e305a35-9a0d-452e-a267-180b77552f95-06_Google Gsuite ID-2394 (Rs. 1534).pdf', 2, 10, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1534.00, 3, 1, 5, '2026-04-02 11:51:26', NULL, NULL, NULL),
(10, 1, 2, 1, 'Google Asia Pvt LTD', '2026-03-24', 1, 'INW 240326I049903166 USD181378.16@93.819\r\nFeb.-2026 month, admob:-jksol infotech', 1.00000000, 17016717.59, 17016717.59, '/uploads/transactions/f228433c-c84c-4d0b-83a6-90be45c84d14-116_HDFC Bank (Rs. 1,70,16,717.59).pdf', 2, 11, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 17016717.59, 4, 1, 5, '2026-04-02 11:59:00', NULL, NULL, NULL),
(11, 1, 3, 2, 'Google India Pvt. LTD (Gsuite)', '2026-04-06', 2, '', 1.00000000, 52200.00, 52200.00, NULL, 7, 10, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 52200.00, 3, 1, 35, '2026-04-06 04:00:08', '2026-05-26 04:11:23', NULL, NULL),
(12, 1, 3, 2, 'Cell Rebel AB', '2026-04-06', 1, '', 1.00000000, 90000.00, 900000.00, '/uploads/transactions/23d39264-d50d-4d73-b48a-614f7d521ec0-INV-000884.pdf', 7, 11, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 90000.00, 5, 1, 35, '2026-04-06 04:00:45', '2026-05-26 04:06:43', NULL, NULL),
(13, 1, 3, 2, 'Google Asia Pvt LTD', '2026-04-06', 2, '', 1.00000000, 100.00, 100.00, NULL, 7, 13, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 100.00, 4, 1, 35, '2026-04-06 10:08:23', '2026-05-26 04:05:53', NULL, NULL),
(14, 1, 2, 2, 'Google India Pvt. LTD (Gsuite)', '2026-04-07', 2, '', 1.00000000, 5000.00, 5000.00, NULL, 2, 10, 7, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 5000.00, 3, 1, 5, '2026-04-07 12:11:06', NULL, NULL, NULL),
(15, 1, 2, 2, 'NJ India', '2026-04-10', 3, '', 1.00000000, 500000.00, 500000.00, NULL, 2, 15, 9, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 500000.00, 6, 1, 5, '2026-04-10 05:09:42', '2026-04-10 05:10:55', NULL, NULL),
(16, 1, 2, 2, '', '2026-04-10', 4, '', 1.00000000, 1500000.00, 1500000.00, NULL, 2, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1500000.00, NULL, 1, 5, '2026-04-10 05:21:51', NULL, NULL, NULL),
(17, 1, 2, 2, '', '2026-04-10', 4, '', 1.00000000, 5000000.00, 5000000.00, NULL, 2, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 5000000.00, NULL, 1, 5, '2026-04-10 05:40:23', NULL, NULL, NULL),
(18, 1, 2, 2, '', '2026-04-10', 4, '', 1.00000000, 200000.00, 200000.00, NULL, 2, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 200000.00, NULL, 1, 5, '2026-04-10 05:41:07', NULL, NULL, NULL),
(19, 1, 3, 2, 'Cell Rebel AB', '2026-04-10', 2, '', 1.00000000, 210.00, 210.00, NULL, NULL, 12, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 210.00, 5, 1, 5, '2026-04-10 05:44:15', NULL, NULL, NULL),
(20, 1, 3, 2, 'Cell Rebel AB', '2026-04-10', 2, '', 1.00000000, 210.00, 7345.00, NULL, 7, 12, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 210.00, 5, 1, 35, '2026-04-10 05:48:38', '2026-05-26 04:12:30', NULL, NULL),
(21, 1, 3, 2, 'NJ India', '2026-05-23', 3, '', 3.67250000, 2523.00, 9265.72, NULL, 1, 15, 9, 0, NULL, NULL, NULL, NULL, NULL, NULL, 0, 9265.72, 6, 1, 3, '2026-05-23 06:23:01', NULL, NULL, NULL),
(27, 1, 3, 1, 'Transaction', '2026-01-01', 2, 'NEFT DR-ICIC0001837-KALPESH PRAVINBHAI P ADSHALA-NETBANK, MUM-HDFCH00707242240-CA PITAL', 1.00000000, 8000000.00, 8000000.00, NULL, 7, 17, NULL, 1, 1, 18.00, 720000.00, 720000.00, 0.00, 1440000.00, 0, 9440000.00, NULL, 1, 35, '2026-05-26 06:11:21', NULL, NULL, 4);

-- --------------------------------------------------------

--
-- Table structure for table `transaction_entries`
--

CREATE TABLE `transaction_entries` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `transaction_id` bigint(20) UNSIGNED NOT NULL,
  `account_id` bigint(20) UNSIGNED NOT NULL,
  `debit` decimal(18,2) NOT NULL DEFAULT 0.00,
  `credit` decimal(18,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transaction_entries`
--

INSERT INTO `transaction_entries` (`id`, `transaction_id`, `account_id`, `debit`, `credit`, `description`) VALUES
(21, 8, 10, 1534.00, 0.00, 'Expense'),
(22, 8, 2, 0.00, 1534.00, 'Paid From'),
(23, 9, 10, 1534.00, 0.00, 'Expense'),
(24, 9, 2, 0.00, 1534.00, 'Paid From'),
(25, 10, 2, 17016717.59, 0.00, 'Deposit To'),
(26, 10, 11, 0.00, 17016717.59, 'Income Source'),
(29, 7, 5, 100000.00, 0.00, 'Transfer In'),
(30, 7, 2, 0.00, 100000.00, 'Transfer Out'),
(37, 14, 10, 5000.00, 0.00, 'Expense'),
(38, 14, 5, 0.00, 5000.00, 'Paid From'),
(41, 15, 3, 500000.00, 0.00, 'Investment'),
(42, 15, 2, 0.00, 500000.00, 'Paid From'),
(43, 16, 2, 1500000.00, 0.00, 'Transfer In'),
(44, 16, 5, 0.00, 1500000.00, 'Transfer Out'),
(45, 17, 5, 5000000.00, 0.00, 'Transfer In'),
(46, 17, 2, 0.00, 5000000.00, 'Transfer Out'),
(47, 18, 1, 200000.00, 0.00, 'Transfer In'),
(48, 18, 2, 0.00, 200000.00, 'Transfer Out'),
(49, 19, 12, 210.00, 0.00, 'Expense'),
(50, 19, 6, 0.00, 210.00, 'Paid From'),
(53, 21, 3, 2523.00, 0.00, 'Investment'),
(54, 21, 2, 0.00, 2523.00, 'Paid From'),
(59, 13, 13, 100.00, 0.00, 'Expense'),
(60, 13, 6, 0.00, 100.00, 'Paid From'),
(61, 12, 6, 90000.00, 0.00, 'Deposit To'),
(62, 12, 11, 0.00, 90000.00, 'Income Source'),
(63, 11, 10, 52200.00, 0.00, 'Expense'),
(64, 11, 6, 0.00, 52200.00, 'Paid From'),
(67, 20, 12, 210.00, 0.00, 'Expense'),
(68, 20, 6, 0.00, 210.00, 'Paid From'),
(83, 27, 17, 9440000.00, 0.00, 'Expense'),
(84, 27, 2, 0.00, 9440000.00, 'Paid From');

-- --------------------------------------------------------

--
-- Table structure for table `transaction_types`
--

CREATE TABLE `transaction_types` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `transaction_types`
--

INSERT INTO `transaction_types` (`id`, `name`) VALUES
(2, 'Expense'),
(1, 'Income'),
(3, 'Investment'),
(4, 'Transfer');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `full_name` varchar(150) DEFAULT NULL,
  `email` varchar(190) NOT NULL,
  `role_id` bigint(20) UNSIGNED DEFAULT NULL,
  `org_ids` text DEFAULT NULL,
  `branch_ids` text DEFAULT NULL,
  `profile_photo` longtext DEFAULT NULL,
  `preferences` longtext DEFAULT NULL,
  `otp` varchar(6) DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `otp_is_used` tinyint(1) NOT NULL DEFAULT 0,
  `refresh_tokens` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`refresh_tokens`)),
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_expires_at` datetime DEFAULT NULL,
  `verification_token` varchar(255) DEFAULT NULL,
  `status` int(11) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `full_name`, `email`, `role_id`, `org_ids`, `branch_ids`, `profile_photo`, `preferences`, `otp`, `otp_expires_at`, `otp_is_used`, `refresh_tokens`, `reset_token`, `reset_expires_at`, `verification_token`, `status`, `created_by`, `last_login_at`, `created_at`, `updated_at`) VALUES
(1, 'Saurav', 'swainfo.saurav@gmail.com', 1, '1', '', NULL, NULL, '926677', '2026-05-25 10:20:56', 1, '[{\"token\":\"90a831a5-5e1a-42cf-8b92-0118c9e8ea8f\",\"expiresAt\":\"2026-06-24T10:16:17.321Z\",\"createdAt\":\"2026-05-25T10:16:17.321Z\"}]', NULL, NULL, NULL, 1, NULL, NULL, '2026-04-02 03:17:38', '2026-05-26 05:33:47'),
(3, 'Ronak', 'ronak@jksol.com', 1, '1', '1', NULL, '{\"currency\":\"INR\"}', '899958', '2026-05-23 06:24:04', 1, '[{\"token\":\"5746442b-9228-48ed-afe6-bc6136436621\",\"expiresAt\":\"2026-06-22T06:19:18.041Z\",\"createdAt\":\"2026-05-23T06:19:18.041Z\"}]', NULL, NULL, NULL, 1, 1, NULL, '2026-04-02 03:27:10', '2026-05-23 06:19:18'),
(5, 'Jatin', 'jksol.jatin@gmail.com', 1, '1', '1', NULL, '{\"currency\":\"INR\",\"dateFormat\":\"DD/MM/YYYY\"}', '347235', '2026-04-22 07:13:15', 1, '[]', NULL, NULL, NULL, 1, 1, NULL, '2026-04-02 03:35:04', '2026-04-22 09:32:26'),
(35, 'Yesha Rana', 'jksol.yesha@gmail.com', 1, '1', '', NULL, '{\"currency\":\"INR\",\"dateFormat\":\"DD MMM, YYYY (d M, Y)\",\"numberFormat\":\"en-IN\"}', '902722', '2026-05-25 11:38:49', 1, '[{\"token\":\"7987faa9-c918-4990-8e2a-671fa1a43ae7\",\"expiresAt\":\"2026-06-24T11:34:08.398Z\",\"createdAt\":\"2026-05-25T11:34:08.398Z\"}]', NULL, NULL, NULL, 1, 1, NULL, '2026-04-27 11:17:43', '2026-05-26 05:26:16'),
(37, 'Kalpesh', 'kalpesh@jksol.com', 1, '1', '', NULL, '{\"currency\":\"INR\"}', '750506', '2026-04-28 06:20:43', 1, '[{\"token\":\"082b655a-4ac7-4d9b-b8c8-c214be9e0a90\",\"expiresAt\":\"2026-05-28T06:16:00.314Z\",\"createdAt\":\"2026-04-28T06:16:00.314Z\"}]', NULL, NULL, NULL, 1, 1, NULL, '2026-04-28 06:09:43', '2026-04-28 06:26:05');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_acc_org_name` (`org_id`,`name`),
  ADD KEY `idx_acc_type` (`account_type`),
  ADD KEY `idx_acc_subtype` (`subtype`),
  ADD KEY `accounts_created_by_users_id_fk` (`created_by`),
  ADD KEY `accounts_currency_id_currencies_id_fk` (`currency_id`),
  ADD KEY `idx_acc_org_created` (`org_id`,`created_at`),
  ADD KEY `idx_acc_org` (`org_id`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_org_entity` (`org_id`,`entity`,`entity_id`),
  ADD KEY `idx_audit_org_time` (`org_id`,`action_at`);

--
-- Indexes for table `branches`
--
ALTER TABLE `branches`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_branch_org` (`org_id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_cat_org_type_name` (`org_id`,`txn_type_id`,`name`),
  ADD KEY `categories_txn_type_id_transaction_types_id_fk` (`txn_type_id`),
  ADD KEY `idx_cat_org_type` (`org_id`,`txn_type_id`);

--
-- Indexes for table `countries`
--
ALTER TABLE `countries`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `currencies`
--
ALTER TABLE `currencies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_currency_code` (`code`);

--
-- Indexes for table `exchange_rates`
--
ALTER TABLE `exchange_rates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_fx_org_date_pair` (`org_id`,`rate_date`,`from_currency`,`to_currency`),
  ADD KEY `idx_fx_org_date` (`org_id`,`rate_date`);

--
-- Indexes for table `financial_years`
--
ALTER TABLE `financial_years`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_fy_org_name` (`org_id`,`name`);

--
-- Indexes for table `imported_statements`
--
ALTER TABLE `imported_statements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_imp_stmt_org_branch` (`org_id`,`branch_id`),
  ADD KEY `idx_imp_stmt_fy` (`financial_year_id`),
  ADD KEY `idx_imp_stmt_file_hash` (`org_id`,`file_hash`),
  ADD KEY `idx_imp_stmt_fingerprint` (`org_id`,`statement_fingerprint`);

--
-- Indexes for table `organizations`
--
ALTER TABLE `organizations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_org_name` (`name`);

--
-- Indexes for table `parties`
--
ALTER TABLE `parties`
  ADD PRIMARY KEY (`id`),
  ADD KEY `parties_created_by_users_id_fk` (`created_by`),
  ADD KEY `idx_party_org_branch` (`org_id`),
  ADD KEY `idx_party_org` (`org_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_role_name` (`name`);

--
-- Indexes for table `sub_categories`
--
ALTER TABLE `sub_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_subcat_cat_name` (`category_id`,`name`),
  ADD KEY `idx_subcat_cat` (`category_id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `transactions_branch_id_branches_id_fk` (`branch_id`),
  ADD KEY `transactions_financial_year_id_financial_years_id_fk` (`financial_year_id`),
  ADD KEY `transactions_txn_type_id_transaction_types_id_fk` (`txn_type_id`),
  ADD KEY `transactions_created_by_users_id_fk` (`created_by`),
  ADD KEY `idx_tx_org_branch_date` (`org_id`,`branch_id`,`txn_date`),
  ADD KEY `idx_tx_org_fy_branch` (`org_id`,`financial_year_id`,`branch_id`),
  ADD KEY `idx_tx_org_status_date` (`org_id`,`status`,`txn_date`),
  ADD KEY `transactions_currency_id_currencies_id_fk` (`currency_id`),
  ADD KEY `transactions_category_id_categories_id_fk` (`category_id`),
  ADD KEY `transactions_sub_category_id_sub_categories_id_fk` (`sub_category_id`),
  ADD KEY `transactions_contact_id_parties_id_fk` (`contact_id`),
  ADD KEY `idx_tx_org_fy_date_created` (`org_id`,`financial_year_id`,`txn_date`,`created_at`),
  ADD KEY `idx_tx_org_fy_branch_date_created` (`org_id`,`financial_year_id`,`branch_id`,`txn_date`,`created_at`);

--
-- Indexes for table `transaction_entries`
--
ALTER TABLE `transaction_entries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tx_ent_tx_id` (`transaction_id`),
  ADD KEY `idx_tx_ent_acc_id` (`account_id`),
  ADD KEY `idx_tx_ent_tx_acc_id` (`transaction_id`,`account_id`);

--
-- Indexes for table `transaction_types`
--
ALTER TABLE `transaction_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_txn_type_name` (`name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_user_email` (`email`),
  ADD KEY `idx_user_role_id` (`role_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=184;

--
-- AUTO_INCREMENT for table `branches`
--
ALTER TABLE `branches`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `currencies`
--
ALTER TABLE `currencies`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=144;

--
-- AUTO_INCREMENT for table `exchange_rates`
--
ALTER TABLE `exchange_rates`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=168;

--
-- AUTO_INCREMENT for table `financial_years`
--
ALTER TABLE `financial_years`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `imported_statements`
--
ALTER TABLE `imported_statements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `organizations`
--
ALTER TABLE `organizations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `parties`
--
ALTER TABLE `parties`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `sub_categories`
--
ALTER TABLE `sub_categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `transaction_entries`
--
ALTER TABLE `transaction_entries`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=85;

--
-- AUTO_INCREMENT for table `transaction_types`
--
ALTER TABLE `transaction_types`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `accounts`
--
ALTER TABLE `accounts`
  ADD CONSTRAINT `accounts_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `accounts_currency_id_currencies_id_fk` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`),
  ADD CONSTRAINT `accounts_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`);

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`);

--
-- Constraints for table `branches`
--
ALTER TABLE `branches`
  ADD CONSTRAINT `branches_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`);

--
-- Constraints for table `categories`
--
ALTER TABLE `categories`
  ADD CONSTRAINT `categories_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`),
  ADD CONSTRAINT `categories_txn_type_id_transaction_types_id_fk` FOREIGN KEY (`txn_type_id`) REFERENCES `transaction_types` (`id`);

--
-- Constraints for table `exchange_rates`
--
ALTER TABLE `exchange_rates`
  ADD CONSTRAINT `exchange_rates_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`);

--
-- Constraints for table `financial_years`
--
ALTER TABLE `financial_years`
  ADD CONSTRAINT `financial_years_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`);

--
-- Constraints for table `parties`
--
ALTER TABLE `parties`
  ADD CONSTRAINT `parties_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `parties_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`);

--
-- Constraints for table `sub_categories`
--
ALTER TABLE `sub_categories`
  ADD CONSTRAINT `sub_categories_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `transactions`
--
ALTER TABLE `transactions`
  ADD CONSTRAINT `transactions_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`),
  ADD CONSTRAINT `transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
  ADD CONSTRAINT `transactions_contact_id_parties_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `parties` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `transactions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `transactions_currency_id_currencies_id_fk` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`),
  ADD CONSTRAINT `transactions_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years` (`id`),
  ADD CONSTRAINT `transactions_org_id_organizations_id_fk` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`),
  ADD CONSTRAINT `transactions_sub_category_id_sub_categories_id_fk` FOREIGN KEY (`sub_category_id`) REFERENCES `sub_categories` (`id`),
  ADD CONSTRAINT `transactions_txn_type_id_transaction_types_id_fk` FOREIGN KEY (`txn_type_id`) REFERENCES `transaction_types` (`id`);

--
-- Constraints for table `transaction_entries`
--
ALTER TABLE `transaction_entries`
  ADD CONSTRAINT `transaction_entries_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

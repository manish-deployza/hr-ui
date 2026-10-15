-- Leave schema (MySQL 8 / InnoDB). Derived from API-REQUIREMENTS.md and data/*.json.
-- Assumes an existing `employee` table with a BIGINT UNSIGNED `id` primary key.

CREATE TABLE leave_type (
    id                            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code                          VARCHAR(32)  NOT NULL,
    name                          VARCHAR(100) NOT NULL,
    days_per_year                 VARCHAR(64)  NOT NULL COMMENT 'display string, e.g. "14 days/year"',
    requires_advance_notice_days  INT          NULL,
    info_note                     TEXT         NULL,
    applicable_employee_type      VARCHAR(32)  NULL COMMENT 'NULL = all employee types',
    is_active                     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at                    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_leave_type_code (code)
) ENGINE=InnoDB;

CREATE TABLE leave_balance (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id    BIGINT UNSIGNED NOT NULL,
    leave_type_id  BIGINT UNSIGNED NOT NULL,
    balance        DECIMAL(5,1)    NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_leave_balance_emp_type (employee_id, leave_type_id),
    CONSTRAINT fk_leave_balance_employee   FOREIGN KEY (employee_id)   REFERENCES employee (id),
    CONSTRAINT fk_leave_balance_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_type (id)
) ENGINE=InnoDB;

CREATE TABLE leave_request (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_id    BIGINT UNSIGNED NOT NULL,
    leave_type_id  BIGINT UNSIGNED NOT NULL,
    start_date     DATE            NOT NULL,
    end_date       DATE            NOT NULL,
    num_days       DECIMAL(5,1)    NOT NULL,
    status         VARCHAR(20)     NOT NULL DEFAULT 'APPLIED',
    reason         TEXT            NULL,
    is_hr_imposed  BOOLEAN         NOT NULL DEFAULT FALSE,
    hr_notes       TEXT            NULL,
    cancelled_at   TIMESTAMP       NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_leave_request_employee (employee_id, start_date),
    KEY idx_leave_request_status (status),
    CONSTRAINT fk_leave_request_employee   FOREIGN KEY (employee_id)   REFERENCES employee (id),
    CONSTRAINT fk_leave_request_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_type (id),
    CONSTRAINT ck_leave_request_dates  CHECK (end_date >= start_date),
    CONSTRAINT ck_leave_request_status CHECK (status IN
        ('APPLIED','PENDING_MANAGER','PENDING_HR','APPROVED','REJECTED','CANCELLED','LAPSED'))
) ENGINE=InnoDB;

CREATE TABLE leave_request_approval (
    id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    leave_request_id      BIGINT UNSIGNED NOT NULL,
    step_order            INT             NOT NULL,
    approver_role         VARCHAR(10)     NOT NULL,
    approver_employee_id  BIGINT UNSIGNED NULL,
    action                VARCHAR(10)     NOT NULL DEFAULT 'PENDING',
    comments              TEXT            NULL,
    acted_at              TIMESTAMP       NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_leave_approval_step (leave_request_id, step_order),
    CONSTRAINT fk_leave_approval_request  FOREIGN KEY (leave_request_id)     REFERENCES leave_request (id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_approval_approver FOREIGN KEY (approver_employee_id) REFERENCES employee (id),
    CONSTRAINT ck_leave_approval_role   CHECK (approver_role IN ('MANAGER','HR')),
    CONSTRAINT ck_leave_approval_action CHECK (action IN ('PENDING','APPROVED','REJECTED'))
) ENGINE=InnoDB;

CREATE TABLE public_holiday (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name              VARCHAR(100)    NOT NULL,
    holiday_date      DATE            NOT NULL,
    year              SMALLINT        NOT NULL,
    non_negotiable    BOOLEAN         NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uk_public_holiday_date (holiday_date),
    KEY idx_public_holiday_year (year)
) ENGINE=InnoDB;

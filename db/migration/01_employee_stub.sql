-- Minimal placeholder so the leave FKs resolve. Replace/extend when the real employee schema lands.
CREATE TABLE employee (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_code  VARCHAR(32)  NOT NULL,
    name           VARCHAR(150) NOT NULL,
    email          VARCHAR(190) NOT NULL,
    employee_type  VARCHAR(32)  NOT NULL DEFAULT 'REGULAR',
    manager_id     BIGINT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_employee_code (employee_code),
    UNIQUE KEY uk_employee_email (email),
    CONSTRAINT fk_employee_manager FOREIGN KEY (manager_id) REFERENCES employee (id)
) ENGINE=InnoDB;

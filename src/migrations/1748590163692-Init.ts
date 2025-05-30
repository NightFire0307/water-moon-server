import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1748590163692 implements MigrationInterface {
    name = 'Init1748590163692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`permissions\` (\`id\` int NOT NULL AUTO_INCREMENT, \`code\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`endpoint\` varchar(255) NULL, \`action\` varchar(255) NULL, \`type\` varchar(255) NOT NULL, \`description\` varchar(100) NOT NULL COMMENT '权限描述' DEFAULT '', \`parentId\` bigint NULL COMMENT '父级权限ID', \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_8dad765629e83229da6feda1c1\` (\`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`roles\` (\`roleId\` int NOT NULL AUTO_INCREMENT, \`code\` varchar(20) NOT NULL COMMENT '角色编码', \`name\` varchar(20) NOT NULL COMMENT '角色名称', \`description\` varchar(255) NOT NULL COMMENT '角色描述' DEFAULT '', \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`roleId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`users\` (\`user_id\` int NOT NULL AUTO_INCREMENT, \`username\` varchar(50) NOT NULL COMMENT '用户名', \`nick_name\` varchar(50) NOT NULL COMMENT '昵称', \`phoneNumber\` varchar(20) NOT NULL COMMENT '手机号', \`password\` varchar(150) NOT NULL COMMENT '密码', \`isSuperAdmin\` tinyint NOT NULL COMMENT '是否超级管理员' DEFAULT 0, \`isFrozen\` tinyint NOT NULL COMMENT '是否冻结' DEFAULT 0, \`isDelete\` tinyint NOT NULL COMMENT '是否删除' DEFAULT 0, \`createTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updateTime\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`user_id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`product_types\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(150) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_2b3bfea1c7797e9d067dfc3c7a\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`products\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`photo_limit\` int NOT NULL DEFAULT '0', \`is_published\` tinyint NOT NULL DEFAULT 1, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`productTypeId\` int NULL, UNIQUE INDEX \`IDX_4c9fb58de893725258746385e1\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`order_products\` (\`id\` int NOT NULL AUTO_INCREMENT, \`count\` int NOT NULL DEFAULT '1', \`remark\` text NULL, \`orderId\` int NULL, \`productId\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`photos\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`oss_file_key\` varchar(255) NOT NULL, \`size\` int NOT NULL, \`is_selected\` tinyint NOT NULL DEFAULT 0, \`is_recommended\` tinyint NOT NULL DEFAULT 0, \`is_deleted\` tinyint NOT NULL DEFAULT 0, \`remark\` varchar(255) NOT NULL DEFAULT '', \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`order_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`orders\` (\`id\` int NOT NULL AUTO_INCREMENT, \`order_number\` varchar(255) NOT NULL, \`customer_name\` varchar(255) NOT NULL, \`customer_phone\` varchar(255) NOT NULL, \`max_select_photos\` int NOT NULL DEFAULT '0', \`extra_photo_price\` float NOT NULL DEFAULT '0', \`status\` enum ('0', '1', '2', '3', '4') NOT NULL DEFAULT '0', \`is_deleted\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`links\` (\`id\` int NOT NULL AUTO_INCREMENT, \`share_url\` varchar(255) NOT NULL, \`share_password\` varchar(255) NOT NULL, \`status\` varchar(255) NOT NULL, \`created_by\` int NOT NULL, \`expired_at\` timestamp NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`order_id\` int NULL, UNIQUE INDEX \`IDX_f3435aff41f3329f9e0faca141\` (\`share_url\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`role_permissions\` (\`rolesRoleId\` int NOT NULL, \`permissionsId\` int NOT NULL, INDEX \`IDX_78959ba1e4a69717cc5128a067\` (\`rolesRoleId\`), INDEX \`IDX_d422dabc78ff74a8dab6583da0\` (\`permissionsId\`), PRIMARY KEY (\`rolesRoleId\`, \`permissionsId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user_roles\` (\`usersUserId\` int NOT NULL, \`rolesRoleId\` int NOT NULL, INDEX \`IDX_c4cf52cd250f708f01691ec9dd\` (\`usersUserId\`), INDEX \`IDX_17b9c62d0a0ca0c2199e15c525\` (\`rolesRoleId\`), PRIMARY KEY (\`usersUserId\`, \`rolesRoleId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`order_product_photos\` (\`orderProductsId\` int NOT NULL, \`photosId\` int NOT NULL, INDEX \`IDX_b549bd974630342cb41cbe6f5c\` (\`orderProductsId\`), INDEX \`IDX_89fdd9a9268ec94141fa98c34b\` (\`photosId\`), PRIMARY KEY (\`orderProductsId\`, \`photosId\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`products\` ADD CONSTRAINT \`FK_fed065ae1a8b80a37a9230da1fa\` FOREIGN KEY (\`productTypeId\`) REFERENCES \`product_types\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`order_products\` ADD CONSTRAINT \`FK_28b66449cf7cd76444378ad4e92\` FOREIGN KEY (\`orderId\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`order_products\` ADD CONSTRAINT \`FK_27ca18f2453639a1cafb7404ece\` FOREIGN KEY (\`productId\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`photos\` ADD CONSTRAINT \`FK_7cfbde0e9cebbd060d0d46015d7\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`links\` ADD CONSTRAINT \`FK_1d223732c99bb2729b73f802cf4\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_78959ba1e4a69717cc5128a0674\` FOREIGN KEY (\`rolesRoleId\`) REFERENCES \`roles\`(\`roleId\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` ADD CONSTRAINT \`FK_d422dabc78ff74a8dab6583da02\` FOREIGN KEY (\`permissionsId\`) REFERENCES \`permissions\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_c4cf52cd250f708f01691ec9ddb\` FOREIGN KEY (\`usersUserId\`) REFERENCES \`users\`(\`user_id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`user_roles\` ADD CONSTRAINT \`FK_17b9c62d0a0ca0c2199e15c525d\` FOREIGN KEY (\`rolesRoleId\`) REFERENCES \`roles\`(\`roleId\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`order_product_photos\` ADD CONSTRAINT \`FK_b549bd974630342cb41cbe6f5cd\` FOREIGN KEY (\`orderProductsId\`) REFERENCES \`order_products\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`order_product_photos\` ADD CONSTRAINT \`FK_89fdd9a9268ec94141fa98c34b2\` FOREIGN KEY (\`photosId\`) REFERENCES \`photos\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`order_product_photos\` DROP FOREIGN KEY \`FK_89fdd9a9268ec94141fa98c34b2\``);
        await queryRunner.query(`ALTER TABLE \`order_product_photos\` DROP FOREIGN KEY \`FK_b549bd974630342cb41cbe6f5cd\``);
        await queryRunner.query(`ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_17b9c62d0a0ca0c2199e15c525d\``);
        await queryRunner.query(`ALTER TABLE \`user_roles\` DROP FOREIGN KEY \`FK_c4cf52cd250f708f01691ec9ddb\``);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_d422dabc78ff74a8dab6583da02\``);
        await queryRunner.query(`ALTER TABLE \`role_permissions\` DROP FOREIGN KEY \`FK_78959ba1e4a69717cc5128a0674\``);
        await queryRunner.query(`ALTER TABLE \`links\` DROP FOREIGN KEY \`FK_1d223732c99bb2729b73f802cf4\``);
        await queryRunner.query(`ALTER TABLE \`photos\` DROP FOREIGN KEY \`FK_7cfbde0e9cebbd060d0d46015d7\``);
        await queryRunner.query(`ALTER TABLE \`order_products\` DROP FOREIGN KEY \`FK_27ca18f2453639a1cafb7404ece\``);
        await queryRunner.query(`ALTER TABLE \`order_products\` DROP FOREIGN KEY \`FK_28b66449cf7cd76444378ad4e92\``);
        await queryRunner.query(`ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_fed065ae1a8b80a37a9230da1fa\``);
        await queryRunner.query(`DROP INDEX \`IDX_89fdd9a9268ec94141fa98c34b\` ON \`order_product_photos\``);
        await queryRunner.query(`DROP INDEX \`IDX_b549bd974630342cb41cbe6f5c\` ON \`order_product_photos\``);
        await queryRunner.query(`DROP TABLE \`order_product_photos\``);
        await queryRunner.query(`DROP INDEX \`IDX_17b9c62d0a0ca0c2199e15c525\` ON \`user_roles\``);
        await queryRunner.query(`DROP INDEX \`IDX_c4cf52cd250f708f01691ec9dd\` ON \`user_roles\``);
        await queryRunner.query(`DROP TABLE \`user_roles\``);
        await queryRunner.query(`DROP INDEX \`IDX_d422dabc78ff74a8dab6583da0\` ON \`role_permissions\``);
        await queryRunner.query(`DROP INDEX \`IDX_78959ba1e4a69717cc5128a067\` ON \`role_permissions\``);
        await queryRunner.query(`DROP TABLE \`role_permissions\``);
        await queryRunner.query(`DROP INDEX \`IDX_f3435aff41f3329f9e0faca141\` ON \`links\``);
        await queryRunner.query(`DROP TABLE \`links\``);
        await queryRunner.query(`DROP TABLE \`orders\``);
        await queryRunner.query(`DROP TABLE \`photos\``);
        await queryRunner.query(`DROP TABLE \`order_products\``);
        await queryRunner.query(`DROP INDEX \`IDX_4c9fb58de893725258746385e1\` ON \`products\``);
        await queryRunner.query(`DROP TABLE \`products\``);
        await queryRunner.query(`DROP INDEX \`IDX_2b3bfea1c7797e9d067dfc3c7a\` ON \`product_types\``);
        await queryRunner.query(`DROP TABLE \`product_types\``);
        await queryRunner.query(`DROP TABLE \`users\``);
        await queryRunner.query(`DROP TABLE \`roles\``);
        await queryRunner.query(`DROP INDEX \`IDX_8dad765629e83229da6feda1c1\` ON \`permissions\``);
        await queryRunner.query(`DROP TABLE \`permissions\``);
    }

}

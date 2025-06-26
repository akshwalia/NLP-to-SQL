#!/usr/bin/env python3
"""
Database Migration Script for PostgreSQL Deployment
This script helps you backup, migrate, and deploy your PostgreSQL database.
"""

import os
import subprocess
import sys
import argparse
from datetime import datetime
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class DatabaseMigrator:
    def __init__(self):
        self.local_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'ecommerce'),
            'username': os.getenv('DB_USERNAME', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'postgres')
        }
        
    def test_connection(self, config):
        """Test database connection"""
        try:
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                database=config['database'],
                user=config['username'],
                password=config['password']
            )
            conn.close()
            print(f"✅ Successfully connected to {config['host']}:{config['port']}/{config['database']}")
            return True
        except Exception as e:
            print(f"❌ Failed to connect to {config['host']}:{config['port']}/{config['database']}")
            print(f"Error: {e}")
            return False
    
    def backup_database(self, backup_file=None):
        """Create a backup of the local database"""
        if not backup_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = f"backup_{self.local_config['database']}_{timestamp}.dump"
        
        print(f"🔄 Creating backup of local database...")
        
        # Set PGPASSWORD environment variable
        env = os.environ.copy()
        env['PGPASSWORD'] = self.local_config['password']
        
        cmd = [
            'pg_dump',
            '-h', self.local_config['host'],
            '-p', self.local_config['port'],
            '-U', self.local_config['username'],
            '-d', self.local_config['database'],
            '-Fc',  # Custom format
            '-f', backup_file
        ]
        
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✅ Backup created successfully: {backup_file}")
                print(f"   File size: {os.path.getsize(backup_file) / 1024 / 1024:.2f} MB")
                return backup_file
            else:
                print(f"❌ Backup failed: {result.stderr}")
                return None
        except FileNotFoundError:
            print("❌ pg_dump not found. Please install PostgreSQL client tools.")
            return None
    
    def restore_database(self, backup_file, target_config):
        """Restore database to target server"""
        print(f"🔄 Restoring database from {backup_file}...")
        
        # Set PGPASSWORD environment variable
        env = os.environ.copy()
        env['PGPASSWORD'] = target_config['password']
        
        cmd = [
            'pg_restore',
            '-h', target_config['host'],
            '-p', target_config['port'],
            '-U', target_config['username'],
            '-d', target_config['database'],
            '--clean',  # Clean existing objects
            '--if-exists',  # Don't error if objects don't exist
            backup_file
        ]
        
        try:
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            if result.returncode == 0:
                print("✅ Database restored successfully!")
                return True
            else:
                print(f"⚠️ Restore completed with warnings: {result.stderr}")
                return True  # Often warnings are not critical
        except FileNotFoundError:
            print("❌ pg_restore not found. Please install PostgreSQL client tools.")
            return False
    
    def parse_database_url(self, database_url):
        """Parse database URL into config dict"""
        parsed = urlparse(database_url)
        return {
            'host': parsed.hostname,
            'port': str(parsed.port or 5432),
            'database': parsed.path.lstrip('/'),
            'username': parsed.username,
            'password': parsed.password
        }
    
    def get_database_info(self, config):
        """Get basic information about the database"""
        try:
            conn = psycopg2.connect(
                host=config['host'],
                port=config['port'],
                database=config['database'],
                user=config['username'],
                password=config['password']
            )
            
            cursor = conn.cursor()
            
            # Get database size
            cursor.execute("SELECT pg_size_pretty(pg_database_size(current_database()));")
            size = cursor.fetchone()[0]
            
            # Get table count
            cursor.execute("""
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public';
            """)
            table_count = cursor.fetchone()[0]
            
            # Get total row count (approximate)
            cursor.execute("""
                SELECT SUM(n_tup_ins + n_tup_upd + n_tup_del) as total_rows
                FROM pg_stat_user_tables;
            """)
            result = cursor.fetchone()
            total_rows = result[0] if result[0] else 0
            
            conn.close()
            
            return {
                'size': size,
                'tables': table_count,
                'rows': total_rows
            }
        except Exception as e:
            print(f"Error getting database info: {e}")
            return None
    
    def deploy_to_railway(self):
        """Deploy using Railway"""
        print("🚂 Deploying to Railway...")
        print("1. Make sure Railway CLI is installed: npm install -g @railway/cli")
        print("2. Run: railway login")
        print("3. Run: railway init")
        print("4. Run: railway add postgresql")
        print("5. Get your DATABASE_URL: railway variables")
        print("6. Use the migrate command with your Railway DATABASE_URL")
        
    def deploy_to_heroku(self):
        """Deploy using Heroku"""
        print("🟣 Deploying to Heroku...")
        print("1. Make sure Heroku CLI is installed")
        print("2. Run: heroku create your-app-name")
        print("3. Run: heroku addons:create heroku-postgresql:hobby-dev")
        print("4. Get your DATABASE_URL: heroku config:get DATABASE_URL")
        print("5. Use the migrate command with your Heroku DATABASE_URL")

def main():
    parser = argparse.ArgumentParser(description='PostgreSQL Database Migration Tool')
    parser.add_argument('action', choices=['backup', 'restore', 'migrate', 'info', 'test', 'deploy-railway', 'deploy-heroku'],
                        help='Action to perform')
    parser.add_argument('--backup-file', help='Backup file name')
    parser.add_argument('--target-url', help='Target database URL (postgresql://user:pass@host:port/db)')
    parser.add_argument('--target-host', help='Target database host')
    parser.add_argument('--target-port', default='5432', help='Target database port')
    parser.add_argument('--target-db', help='Target database name')
    parser.add_argument('--target-user', help='Target database username')
    parser.add_argument('--target-password', help='Target database password')
    
    args = parser.parse_args()
    
    migrator = DatabaseMigrator()
    
    if args.action == 'backup':
        backup_file = migrator.backup_database(args.backup_file)
        if backup_file:
            info = migrator.get_database_info(migrator.local_config)
            if info:
                print(f"📊 Database Info: {info['size']}, {info['tables']} tables, ~{info['rows']} rows")
    
    elif args.action == 'info':
        print("📊 Local Database Information:")
        info = migrator.get_database_info(migrator.local_config)
        if info:
            print(f"   Size: {info['size']}")
            print(f"   Tables: {info['tables']}")
            print(f"   Rows: ~{info['rows']}")
    
    elif args.action == 'test':
        print("🔍 Testing local database connection...")
        migrator.test_connection(migrator.local_config)
        
        if args.target_url:
            print("🔍 Testing target database connection...")
            target_config = migrator.parse_database_url(args.target_url)
            migrator.test_connection(target_config)
    
    elif args.action == 'restore':
        if not args.backup_file or not args.target_url:
            print("❌ Both --backup-file and --target-url are required for restore")
            return
        
        target_config = migrator.parse_database_url(args.target_url)
        migrator.restore_database(args.backup_file, target_config)
    
    elif args.action == 'migrate':
        # Full migration: backup local -> restore to target
        if not args.target_url:
            print("❌ --target-url is required for migration")
            return
        
        print("🚀 Starting full database migration...")
        
        # Step 1: Test connections
        print("1. Testing connections...")
        if not migrator.test_connection(migrator.local_config):
            print("❌ Cannot connect to local database")
            return
        
        target_config = migrator.parse_database_url(args.target_url)
        if not migrator.test_connection(target_config):
            print("❌ Cannot connect to target database")
            return
        
        # Step 2: Create backup
        print("2. Creating backup...")
        backup_file = migrator.backup_database()
        if not backup_file:
            print("❌ Backup failed")
            return
        
        # Step 3: Restore to target
        print("3. Restoring to target...")
        if migrator.restore_database(backup_file, target_config):
            print("✅ Migration completed successfully!")
            print(f"🗑️ You can now delete the backup file: {backup_file}")
        else:
            print("❌ Migration failed during restore")
    
    elif args.action == 'deploy-railway':
        migrator.deploy_to_railway()
    
    elif args.action == 'deploy-heroku':
        migrator.deploy_to_heroku()

if __name__ == '__main__':
    main() 